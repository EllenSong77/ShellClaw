from datetime import datetime, timedelta, timezone

from redis import Redis

from app.models.enums import Plan, SubscriptionStatus
from app.services.plan_config import get_plan_spec


class QuotaExceededError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        upgrade_required: bool = False,
        suggested_plan: Plan | None = None,
        redirect_to: str | None = None,
        action: str | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.upgrade_required = upgrade_required
        self.suggested_plan = suggested_plan
        self.redirect_to = redirect_to
        self.action = action


class QuotaService:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    def _key(self, user_id: str, now: datetime) -> str:
        return f"quota:{user_id}:{now.date().isoformat()}"

    def check_and_consume(self, user_id: str, plan: Plan, subscription_status: SubscriptionStatus | None = None) -> None:
        if plan in {Plan.TRIAL, Plan.PAID_PERSONAL, Plan.PAID_PRO}:
            return

        now = datetime.now(timezone.utc)
        key = self._key(user_id, now)
        count = self.redis.get(key)
        daily_limit = get_plan_spec(plan).task_limit_daily
        if daily_limit is not None and count is not None and int(count) >= daily_limit:
            if subscription_status == SubscriptionStatus.EXPIRED:
                raise QuotaExceededError(
                    "TRIAL_ENDED",
                    "试用已结束，请输入激活码后继续使用。",
                    upgrade_required=True,
                    suggested_plan=Plan.PAID_PERSONAL,
                    redirect_to="/account",
                    action="redeem_code",
                )
            raise QuotaExceededError(
                "DAILY_LIMIT_REACHED",
                "今日额度已用完，请明天再试或输入激活码提升权限。",
                upgrade_required=True,
                suggested_plan=Plan.PAID_PERSONAL,
                redirect_to="/account",
                action="redeem_code",
            )

        tomorrow = datetime.combine((now + timedelta(days=1)).date(), datetime.min.time(), tzinfo=timezone.utc)
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expireat(key, int(tomorrow.timestamp()))
        pipe.execute()
