import json
import time
from pathlib import Path

from redis import Redis

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.enums import TaskStatus
from app.models.task import Task
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


def wait_for_result(user_id: str, task_id: str, timeout: int = 30) -> dict:
    root = workspace_dir(user_id)
    outbox = root / 'outbox'
    outbox.mkdir(parents=True, exist_ok=True)
    result_path = outbox / f'{task_id}.json'
    started = time.time()
    while time.time() - started < timeout:
        if result_path.exists():
            data = json.loads(result_path.read_text(encoding='utf-8'))
            result_path.unlink(missing_ok=True)
            return data
        time.sleep(1)
    return {'task_id': task_id, 'status': 'timeout', 'error': 'worker wait timeout'}


def handle_payload(payload_text: str):
    payload = json.loads(payload_text)
    task_id = payload['task_id']
    user_id = payload['user_id']

    write_task_to_sandbox(user_id, payload)
    result = wait_for_result(user_id, task_id)

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
            chunks = result.get('chunks', [])
            task.llm_calls = 1
            task.output_tokens = sum(len(c) for c in chunks)
            db.add(task)
            db.commit()
    finally:
        db.close()


def main():
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    while True:
        item = redis_client.blpop([TaskQueueService.HIGH, TaskQueueService.LOW], timeout=3)
        if not item:
            continue
        _queue, payload = item
        handle_payload(payload)


if __name__ == '__main__':
    main()
