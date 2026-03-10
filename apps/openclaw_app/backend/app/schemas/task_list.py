from __future__ import annotations

from pydantic import BaseModel

from app.schemas.task import TaskResponse


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
