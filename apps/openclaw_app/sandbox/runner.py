import json
import os
import signal
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path
from threading import Thread

WORKSPACE = Path('/workspace')
INBOX = WORKSPACE / 'inbox'
OUTBOX = WORKSPACE / 'outbox'
EVENTS = WORKSPACE / 'events'
STATE = WORKSPACE / 'state.json'
DEFAULT_TIMEOUT = 120
TASK_COMMAND_TEMPLATE = os.getenv('OPENCLAW_TASK_COMMAND_TEMPLATE', 'bash -lc \'printf %s "{message}"\'')

INBOX.mkdir(parents=True, exist_ok=True)
OUTBOX.mkdir(parents=True, exist_ok=True)
EVENTS.mkdir(parents=True, exist_ok=True)


def ensure_openclaw_home():
    home = Path(os.environ.get('HOME', '/workspace/home'))
    seed = os.environ.get('OPENCLAW_HOME_SEED')
    target = home / '.openclaw'
    home.mkdir(parents=True, exist_ok=True)
    if not seed:
        return

    seed_path = Path(seed)
    if not seed_path.exists() or target.exists():
        return

    shutil.copytree(seed_path, target, dirs_exist_ok=True)
    shutil.rmtree(target / 'extensions', ignore_errors=True)
    shutil.rmtree(target / 'logs', ignore_errors=True)
    shutil.rmtree(target / 'canvas', ignore_errors=True)


def write_state(status: str):
    STATE.write_text(json.dumps({'status': status, 'ts': time.time()}, ensure_ascii=False), encoding='utf-8')


def build_command(task: dict) -> list[str]:
    message = str(task.get('message', '')).strip()
    if not message:
        raise ValueError('empty task message')

    if os.getenv('OPENCLAW_TASK_MODE', 'openclaw') == 'echo':
        return ['python', '-c', f"print({message!r}, end='')"]

    command = task.get('command')
    if command:
        if isinstance(command, list):
            return [str(part) for part in command]
        if isinstance(command, str):
            return shlex.split(command)
        raise ValueError('task.command must be string or list')

    rendered = TASK_COMMAND_TEMPLATE.format(message=message)
    return shlex.split(rendered)


def find_last_openclaw_result(text: str) -> dict | None:
    decoder = json.JSONDecoder()
    last_match = None
    for start in range(len(text)):
        if text[start] != '{':
            continue
        try:
            obj, end = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict) and 'payloads' in obj:
            last_match = obj
    return last_match


def extract_openclaw_text(stdout: str) -> tuple[str, dict | None]:
    text = (stdout or '').strip()
    if not text:
        return '', None

    payload = find_last_openclaw_result(text)
    if isinstance(payload, dict):
        payloads = payload.get('payloads')
        if isinstance(payloads, list) and payloads:
            first = payloads[0]
            if isinstance(first, dict) and isinstance(first.get('text'), str):
                return first['text'], payload
    return stdout, payload if isinstance(payload, dict) else None


def append_event(task_id: str, event: dict):
    event_path = EVENTS / f'{task_id}.jsonl'
    with event_path.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + '\n')


def read_stream(task_id: str, name: str, stream, chunks: list[str]):
    while True:
        chunk = stream.read(1)
        if not chunk:
            break
        chunks.append(chunk)
        append_event(task_id, {'stream': name, 'chunk': chunk})


def run_command(task_id: str, command: list[str], timeout: int) -> dict:
    started = time.time()
    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []
    process = None
    try:
        process = subprocess.Popen(
            command,
            cwd=str(WORKSPACE),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        stdout_thread = Thread(target=read_stream, args=(task_id, 'stdout', process.stdout, stdout_chunks))
        stderr_thread = Thread(target=read_stream, args=(task_id, 'stderr', process.stderr, stderr_chunks))
        stdout_thread.start()
        stderr_thread.start()
        return_code = process.wait(timeout=timeout)
        stdout_thread.join()
        stderr_thread.join()

        stdout = ''.join(stdout_chunks)
        stderr = ''.join(stderr_chunks)
        parsed_text, parsed_json = extract_openclaw_text(stdout)
        status = 'completed' if return_code == 0 else 'error'
        return {
            'status': status,
            'stdout': parsed_text,
            'raw_stdout': stdout,
            'stderr': stderr,
            'return_code': return_code,
            'duration_sec': round(time.time() - started, 3),
            'provider_meta': parsed_json.get('meta') if parsed_json else None,
        }
    except subprocess.TimeoutExpired as exc:
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            if process.stdout:
                process.stdout.close()
            if process.stderr:
                process.stderr.close()
        stdout = ''.join(stdout_chunks)
        stderr = ''.join(stderr_chunks)
        parsed_text, parsed_json = extract_openclaw_text(stdout)
        return {
            'status': 'timeout',
            'stdout': parsed_text,
            'raw_stdout': stdout,
            'stderr': stderr,
            'return_code': None,
            'duration_sec': round(time.time() - started, 3),
            'error': f'command timed out after {timeout}s',
            'provider_meta': parsed_json.get('meta') if parsed_json else None,
        }


def process_task(task_path: Path):
    task = json.loads(task_path.read_text(encoding='utf-8'))
    task_id = task.get('task_id', task_path.stem)
    timeout = int(task.get('timeout_sec') or DEFAULT_TIMEOUT)
    command = build_command(task)
    result = run_command(task_id, command, timeout)
    output = {
        'task_id': task_id,
        'command': command,
        'finished_at': time.time(),
        **result,
    }
    (OUTBOX / f'{task_id}.json').write_text(json.dumps(output, ensure_ascii=False), encoding='utf-8')
    task_path.unlink(missing_ok=True)


def main():
    ensure_openclaw_home()
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
                    'raw_stdout': '',
                    'stderr': '',
                    'return_code': None,
                    'provider_meta': None,
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
