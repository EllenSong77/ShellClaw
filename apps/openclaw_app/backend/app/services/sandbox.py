from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.enums import SandboxStatus
from app.models.user import User
from app.models.sandbox import Sandbox


class SandboxService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_for_user(self, user: User) -> Sandbox:
        sandbox = self.db.query(Sandbox).filter(Sandbox.user_id == user.id).one_or_none()
        if sandbox:
            return sandbox

        sandbox = Sandbox(
            user_id=user.id,
            status=SandboxStatus.CREATING,
            last_active_at=datetime.utcnow(),
            workspace_size_mb=0,
        )
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def mark_running(self, sandbox: Sandbox, container_id: str | None = None) -> Sandbox:
        sandbox.status = SandboxStatus.RUNNING
        sandbox.last_active_at = datetime.utcnow()
        if container_id:
            sandbox.container_id = container_id
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox
