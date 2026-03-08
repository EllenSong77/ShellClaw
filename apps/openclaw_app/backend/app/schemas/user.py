from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.enums import Plan, SandboxStatus


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    plan: Plan
    trial_ends_at: datetime | None
    paid_until: datetime | None

    class Config:
        from_attributes = True


class SandboxResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: SandboxStatus
    container_id: str | None
    workspace_size_mb: int

    class Config:
        from_attributes = True
