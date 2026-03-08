from datetime import datetime, timedelta, timezone

from redis import Redis

from app.core.config import settings
from app.models.enums import Plan


class QuotaExceededError(Exception):
    pass


class QuotaService:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    def _key(self, user_id: str, now: datetime) -> str:
        return f"quota:{user_id}:{now.date().isoformat()}"

    def check_and_consume(self, user_id: str, plan: Plan) -> None:
        if plan in {Plan.TRIAL, Plan.PAID_PERSONAL, Plan.PAID_PRO}:
            return

        now = datetime.now(timezone.utc)
        key = self._key(user_id, now)
        count = self.redis.get(key)
        if count is not None and int(count) >= settings.free_daily_task_limit:
            raise QuotaExceededError("今日免费任务次数已用完")

        tomorrow = datetime.combine((now + timedelta(days=1)).date(), datetime.min.time(), tzinfo=timezone.utc)
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expireat(key, int(tomorrow.timestamp()))
        pipe.execute()
