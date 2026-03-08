import json
import os
import sys
import time
from pathlib import Path

WORKSPACE = Path('/workspace')
INBOX = WORKSPACE / 'inbox'
OUTBOX = WORKSPACE / 'outbox'
STATE = WORKSPACE / 'state.json'

INBOX.mkdir(parents=True, exist_ok=True)
OUTBOX.mkdir(parents=True, exist_ok=True)


def write_state(status: str):
    STATE.write_text(json.dumps({'status': status, 'ts': time.time()}, ensure_ascii=False), encoding='utf-8')


def process_task(task_path: Path):
    task = json.loads(task_path.read_text(encoding='utf-8'))
    task_id = task.get('task_id', task_path.stem)
    message = task.get('message', '')
    output = {
        'task_id': task_id,
        'status': 'completed',
        'chunks': [
            f"[sandbox] 收到任务: {task_id}",
            f"[sandbox] 用户消息: {message}",
            "[sandbox] 当前还是占位执行器，下一步会接入真实 OpenClaw。",
        ],
        'finished_at': time.time(),
    }
    (OUTBOX / f'{task_id}.json').write_text(json.dumps(output, ensure_ascii=False), encoding='utf-8')
    task_path.unlink(missing_ok=True)


def main():
    write_state('running')
    while True:
        tasks = sorted(INBOX.glob('*.json'))
        if not tasks:
            time.sleep(1)
            continue
        for task_path in tasks:
            write_state('busy')
            try:
                process_task(task_path)
            except Exception as exc:
                err = {
                    'task_id': task_path.stem,
                    'status': 'error',
                    'error': str(exc),
                    'finished_at': time.time(),
                }
                (OUTBOX / f'{task_path.stem}.json').write_text(json.dumps(err, ensure_ascii=False), encoding='utf-8')
                task_path.unlink(missing_ok=True)
            finally:
                write_state('running')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        write_state('stopped')
        sys.exit(0)
