from __future__ import annotations

import json
from redis import Redis

from app.models.enums import Plan


class TaskQueueService:
    HIGH = "tasks:high"
    LOW = "tasks:low"

    def __init__(self, redis_client: Redis) -> None:
        self.redis = redis_client

    @classmethod
    def queue_for_plan(cls, plan: Plan) -> str:
        return cls.HIGH if plan in {Plan.PAID_PERSONAL, Plan.PAID_PRO, Plan.TRIAL} else cls.LOW

    def enqueue(self, payload: dict, plan: Plan) -> str:
        queue = self.queue_for_plan(plan)
        self.redis.rpush(queue, json.dumps(payload))
        return queue
