from redis import Redis

from app.core.config import settings
from app.services.task_queue import TaskQueueService


def run_worker_once() -> dict | None:
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    item = redis_client.blpop([TaskQueueService.HIGH, TaskQueueService.LOW], timeout=1)
    if not item:
        return None
    queue_name, payload = item
    return {"queue": queue_name, "payload": payload}
