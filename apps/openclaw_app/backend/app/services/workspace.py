from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings


class WorkspaceService:
    def __init__(self, user_id: str):
        self.root = Path(settings.sandbox_workspace_root) / user_id
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, relative_path: str | None = None) -> Path:
        relative = (relative_path or "").strip().lstrip("/")
        candidate = (self.root / relative).resolve()
        if self.root.resolve() not in candidate.parents and candidate != self.root.resolve():
            raise HTTPException(status_code=400, detail="非法路径")
        return candidate

    def list_entries(self, relative_path: str | None = None) -> tuple[str, list[dict]]:
        target = self._resolve(relative_path)
        if not target.exists():
            raise HTTPException(status_code=404, detail="路径不存在")
        if not target.is_dir():
            raise HTTPException(status_code=400, detail="目标不是目录")

        entries: list[dict] = []
        for entry in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
            stat = entry.stat()
            entries.append(
                {
                    "path": str(entry.relative_to(self.root)),
                    "name": entry.name,
                    "is_dir": entry.is_dir(),
                    "size": 0 if entry.is_dir() else stat.st_size,
                }
            )
        base_path = "" if target == self.root else str(target.relative_to(self.root))
        return base_path, entries

    def read_file(self, relative_path: str) -> Path:
        target = self._resolve(relative_path)
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail="文件不存在")
        return target

    async def save_upload(self, file: UploadFile, relative_dir: str | None = None) -> dict:
        target_dir = self._resolve(relative_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / file.filename
        content = await file.read()
        target.write_bytes(content)
        return {
            "path": str(target.relative_to(self.root)),
            "name": target.name,
            "is_dir": False,
            "size": target.stat().st_size,
        }
