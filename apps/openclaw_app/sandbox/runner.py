import json
import shlex
import subprocess
import sys
import time
from pathlib import Path

WORKSPACE = Path('/workspace')
INBOX = WORKSPACE / 'inbox'
OUTBOX = WORKSPACE / 'outbox'
STATE = WORKSPACE / 'state.json'
DEFAULT_TIMEOUT = 120

INBOX.mkdir(parents=True, exist_ok=True)
OUTBOX.mkdir(parents=True, exist_ok=True)


def write_state(status: str):
    STATE.write_text(json.dumps({'status': status, 'ts': time.time()}, ensure_ascii=False), encoding='utf-8')


def build_command(task: dict) -> list[str]:
    message = str(task.get('message', '')).strip()
    if not message:
        raise ValueError('empty task message')

    command = task.get('command')
    if command:
        if isinstance(command, list):
            return [str(part) for part in command]
        if isinstance(command, str):
            return shlex.split(command)
        raise ValueError('task.command must be string or list')

    return ['bash', '-lc', f'printf %s {shlex.quote(message)}']


def run_command(command: list[str], timeout: int) -> dict:
    started = time.time()
    try:
        completed = subprocess.run(
            command,
            cwd=str(WORKSPACE),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        status = 'completed' if completed.returncode == 0 else 'error'
        return {
            'status': status,
            'stdout': completed.stdout,
            'stderr': completed.stderr,
            'return_code': completed.returncode,
            'duration_sec': round(time.time() - started, 3),
        }
    except subprocess.TimeoutExpired as exc:
        return {
            'status': 'timeout',
            'stdout': exc.stdout or '',
            'stderr': exc.stderr or '',
            'return_code': None,
            'duration_sec': round(time.time() - started, 3),
            'error': f'command timed out after {timeout}s',
        }


def process_task(task_path: Path):
    task = json.loads(task_path.read_text(encoding='utf-8'))
    task_id = task.get('task_id', task_path.stem)
    timeout = int(task.get('timeout_sec', DEFAULT_TIMEOUT))
    command = build_command(task)
    result = run_command(command, timeout)
    output = {
        'task_id': task_id,
        'command': command,
        'finished_at': time.time(),
        **result,
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
                    'stdout': '',
                    'stderr': '',
                    'return_code': None,
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
