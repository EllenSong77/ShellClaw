from enum import StrEnum


class Plan(StrEnum):
    TRIAL = "trial"
    FREE = "free"
    PAID_PERSONAL = "paid_personal"
    PAID_PRO = "paid_pro"


class SubscriptionStatus(StrEnum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"


class BillingProvider(StrEnum):
    MOCK = "mock"
    STRIPE = "stripe"
    ALIPAY = "alipay"
    WECHAT = "wechat"


class BillingOrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class RedeemCodeType(StrEnum):
    PLAN_GRANT = "plan_grant"
    TRIAL_EXTEND = "trial_extend"


class SandboxStatus(StrEnum):
    CREATING = "creating"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ARCHIVED = "archived"


class TaskStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    TIMEOUT = "timeout"
    ERROR = "error"
    CANCELLED = "cancelled"
