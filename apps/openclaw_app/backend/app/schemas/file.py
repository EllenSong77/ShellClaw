from __future__ import annotations

from pydantic import BaseModel


class WorkspaceEntry(BaseModel):
    path: str
    name: str
    is_dir: bool
    size: int


class WorkspaceListResponse(BaseModel):
    base_path: str
    entries: list[WorkspaceEntry]
