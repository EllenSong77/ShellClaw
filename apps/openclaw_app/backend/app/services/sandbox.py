from __future__ import annotations

from datetime import datetime
from datetime import timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import SandboxStatus
from app.models.user import User
from app.models.sandbox import Sandbox
from app.services.docker_sandbox import DockerSandboxManager


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
        sandbox.workspace_size_mb = self._workspace_size_mb(str(sandbox.user_id))
        if container_id:
            sandbox.container_id = container_id
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def mark_paused(self, sandbox: Sandbox) -> Sandbox:
        sandbox.status = SandboxStatus.PAUSED
        sandbox.workspace_size_mb = self._workspace_size_mb(str(sandbox.user_id))
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def mark_stopped(self, sandbox: Sandbox) -> Sandbox:
        sandbox.status = SandboxStatus.STOPPED
        sandbox.workspace_size_mb = self._workspace_size_mb(str(sandbox.user_id))
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def touch(self, sandbox: Sandbox) -> Sandbox:
        sandbox.last_active_at = datetime.utcnow()
        sandbox.workspace_size_mb = self._workspace_size_mb(str(sandbox.user_id))
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def refresh_workspace_size(self, user_id: str) -> Sandbox | None:
        sandbox = self.db.query(Sandbox).filter(Sandbox.user_id == user_id).one_or_none()
        if sandbox is None:
            return None
        sandbox.workspace_size_mb = self._workspace_size_mb(str(user_id))
        self.db.add(sandbox)
        self.db.commit()
        self.db.refresh(sandbox)
        return sandbox

    def pause_idle_sandboxes(self) -> int:
        cutoff = datetime.utcnow() - timedelta(minutes=settings.sandbox_idle_pause_minutes)
        sandboxes = (
            self.db.query(Sandbox)
            .filter(Sandbox.status == SandboxStatus.RUNNING)
            .filter(Sandbox.last_active_at.is_not(None))
            .filter(Sandbox.last_active_at < cutoff)
            .all()
        )
        paused = 0
        manager = DockerSandboxManager()
        for sandbox in sandboxes:
            manager.pause(str(sandbox.user_id))
            sandbox.status = SandboxStatus.PAUSED
            sandbox.workspace_size_mb = self._workspace_size_mb(str(sandbox.user_id))
            self.db.add(sandbox)
            paused += 1
        if paused:
            self.db.commit()
        return paused

    def _workspace_size_mb(self, user_id: str) -> int:
        root = Path(settings.sandbox_workspace_root) / user_id
        if not root.exists():
            return 0

        total_bytes = 0
        for path in root.rglob("*"):
            if path.is_file():
                total_bytes += path.stat().st_size
        return int(total_bytes / (1024 * 1024))
