from __future__ import annotations

import json

from redis import Redis

from app.core.config import settings


def user_events_channel(user_id: str) -> str:
    return f"{settings.task_events_channel_prefix}:{user_id}"


class TaskEventPublisher:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    def publish(self, user_id: str, event: dict) -> None:
        self.redis.publish(user_events_channel(user_id), json.dumps(event, ensure_ascii=False))
