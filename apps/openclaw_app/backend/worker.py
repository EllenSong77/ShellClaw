import json
import time
from datetime import datetime
from pathlib import Path

from redis import Redis
from docker.errors import DockerException
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.daily_usage import DailyUsage
from app.models.sandbox import Sandbox
from app.models.enums import SandboxStatus, TaskStatus
from app.models.task import Task
from app.services.events import TaskEventPublisher
from app.services.sandbox import SandboxService
from app.services.task_queue import TaskQueueService


def workspace_dir(user_id: str) -> Path:
    return Path(settings.sandbox_workspace_root) / user_id


def write_task_to_sandbox(user_id: str, task_payload: dict) -> Path:
    root = workspace_dir(user_id)
    inbox = root / 'inbox'
    inbox.mkdir(parents=True, exist_ok=True)
    task_path = inbox / f"{task_payload['task_id']}.json"
    task_path.write_text(json.dumps(task_payload, ensure_ascii=False), encoding='utf-8')
    return task_path


def task_events_path(user_id: str, task_id: str) -> Path:
    root = workspace_dir(user_id)
    events = root / 'events'
    events.mkdir(parents=True, exist_ok=True)
    return events / f'{task_id}.jsonl'


def publish_task_progress(redis_client: Redis, user_id: str, task_id: str, event: dict) -> None:
    chunk = event.get('chunk')
    TaskEventPublisher(redis_client).publish(
        user_id,
        {
            'type': 'task_delta',
            'task_id': task_id,
            'stream': event.get('stream'),
            'content': chunk,
            **event,
        },
    )


def wait_for_result(redis_client: Redis, user_id: str, task_id: str, timeout: int = 30) -> dict:
    root = workspace_dir(user_id)
    outbox = root / 'outbox'
    outbox.mkdir(parents=True, exist_ok=True)
    result_path = outbox / f'{task_id}.json'
    events_path = task_events_path(user_id, task_id)
    started = time.time()
    last_offset = 0
    while time.time() - started < timeout:
        if events_path.exists():
            with events_path.open('r', encoding='utf-8') as handle:
                handle.seek(last_offset)
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    publish_task_progress(redis_client, user_id, task_id, json.loads(line))
                last_offset = handle.tell()
        if result_path.exists():
            data = json.loads(result_path.read_text(encoding='utf-8'))
            result_path.unlink(missing_ok=True)
            events_path.unlink(missing_ok=True)
            return data
        time.sleep(1)
    events_path.unlink(missing_ok=True)
    return {
        'task_id': task_id,
        'status': 'timeout',
        'error': 'worker wait timeout',
        'stdout': '',
        'stderr': '',
        'return_code': None,
    }


def update_daily_usage(db, task: Task):
    usage_date = task.started_at.date()
    usage = (
        db.query(DailyUsage)
        .filter(DailyUsage.user_id == task.user_id)
        .filter(DailyUsage.date == usage_date)
        .one_or_none()
    )
    if usage is None:
        usage = DailyUsage(user_id=task.user_id, date=usage_date, task_count=0, tokens_used=0, cost_cny=0)
    usage.task_count += 1
    usage.tokens_used += int(task.input_tokens or 0) + int(task.output_tokens or 0)
    db.add(usage)


def handle_payload(redis_client: Redis, payload_text: str):
    payload = json.loads(payload_text)
    task_id = payload['task_id']
    user_id = payload['user_id']
    queue_name = payload.get('queue')

    TaskEventPublisher(redis_client).publish(
        user_id,
        {
            'type': 'task_started',
            'task_id': task_id,
            'status': TaskStatus.RUNNING,
            'queue': queue_name,
        },
    )

    write_task_to_sandbox(user_id, payload)
    timeout_sec = int(payload.get('timeout_sec') or 30)
    result = wait_for_result(redis_client, user_id, task_id, timeout=max(30, timeout_sec + 15))

    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).one_or_none()
        if task:
            status = result.get('status', 'completed')
            task.status = {
                'completed': TaskStatus.COMPLETED,
                'timeout': TaskStatus.TIMEOUT,
                'error': TaskStatus.ERROR,
            }.get(status, TaskStatus.ERROR)
            stdout = result.get('stdout', '') or ''
            stderr = result.get('stderr', '') or ''
            error_text = result.get('error', '') or ''
            task.llm_calls = 1
            task.output_tokens = len(stdout)
            task.input_tokens = len(payload.get('message', '') or '')
            task.stdout_text = stdout
            task.stderr_text = stderr
            task.error_text = error_text
            duration_sec = result.get('duration_sec')
            if duration_sec is not None:
                task.duration_sec = int(float(duration_sec))
            task.ended_at = datetime.utcnow()
            db.add(task)
            sandbox = db.query(Sandbox).filter(Sandbox.id == task.sandbox_id).one_or_none()
            if sandbox:
                sandbox.status = SandboxStatus.RUNNING
                sandbox.last_active_at = datetime.utcnow()
                sandbox.workspace_size_mb = SandboxService(db)._workspace_size_mb(str(task.user_id))
                db.add(sandbox)
            update_daily_usage(db, task)
            db.commit()
            TaskEventPublisher(redis_client).publish(
                user_id,
                {
                    'type': 'task_completed' if task.status == TaskStatus.COMPLETED else 'task_error',
                    'task_id': task_id,
                    'status': task.status,
                    'stdout_text': task.stdout_text,
                    'stderr_text': task.stderr_text,
                    'error_text': task.error_text,
                    'duration_sec': task.duration_sec,
                },
            )
    finally:
        db.close()

    return result


def main():
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    last_idle_check = 0.0
    while True:
        if time.time() - last_idle_check >= 30:
            db = SessionLocal()
            try:
                try:
                    SandboxService(db).pause_idle_sandboxes()
                except (OperationalError, DockerException):
                    time.sleep(2)
            finally:
                db.close()
            last_idle_check = time.time()
        item = redis_client.blpop([TaskQueueService.HIGH, TaskQueueService.LOW], timeout=3)
        if not item:
            continue
        _queue, payload = item
        handle_payload(redis_client, payload)


if __name__ == '__main__':
    main()
