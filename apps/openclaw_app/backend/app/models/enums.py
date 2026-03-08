from enum import StrEnum


class Plan(StrEnum):
    TRIAL = "trial"
    FREE = "free"
    PAID_PERSONAL = "paid_personal"
    PAID_PRO = "paid_pro"


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
