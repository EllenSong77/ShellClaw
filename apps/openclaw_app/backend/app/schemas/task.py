from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TaskStatus


class TaskResponse(BaseModel):
    id: UUID
    user_id: UUID
    sandbox_id: UUID
    started_at: datetime
    ended_at: datetime | None
    duration_sec: int | None
    status: TaskStatus | None
    model_name: str | None
    llm_calls: int
    input_tokens: int
    output_tokens: int
    stdout_text: str | None
    stderr_text: str | None
    error_text: str | None

    class Config:
        from_attributes = True
