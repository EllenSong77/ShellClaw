from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import docker
from docker.errors import DockerException, NotFound

from app.core.config import settings


@dataclass
class DockerSandboxResult:
    container_id: str
    status: str


class DockerSandboxManager:
    PASSTHROUGH_ENV_KEYS = [
        "OPENAI_API_KEY",
        "OPENROUTER_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
    ]

    def __init__(self) -> None:
        self.client = docker.from_env()

    def _container_name(self, user_key: str) -> str:
        safe = user_key.replace('@', '-at-').replace('.', '-').replace('_', '-')
        return f"openclaw-sbx-{safe}"

    def _workspace_dir(self, user_key: str) -> str:
        root = Path("/tmp/openclaw_app/workspaces")
        root.mkdir(parents=True, exist_ok=True)
        target = root / user_key
        target.mkdir(parents=True, exist_ok=True)
        return str(target)

    def _sandbox_env(self, user_key: str) -> dict[str, str]:
        env = {
            "LITELLM_BASE_URL": settings.litellm_base_url,
            "OPENCLAW_USER_KEY": user_key,
            "OPENCLAW_TASK_COMMAND_TEMPLATE": settings.sandbox_command_template,
        }
        for key in self.PASSTHROUGH_ENV_KEYS:
            value = os.getenv(key)
            if value:
                env[key] = value
        return env

    def ensure_running(self, user_key: str) -> DockerSandboxResult:
        name = self._container_name(user_key)
        try:
            container = self.client.containers.get(name)
            container.reload()
            status = container.status
            if status == "paused":
                container.unpause()
                container.reload()
                status = container.status
            elif status in {"exited", "created"}:
                container.start()
                container.reload()
                status = container.status
            return DockerSandboxResult(container_id=container.id, status=status)
        except NotFound:
            return self._create_container(user_key, name)

    def pause(self, user_key: str) -> DockerSandboxResult | None:
        name = self._container_name(user_key)
        try:
            container = self.client.containers.get(name)
            container.reload()
            if container.status == "running":
                container.pause()
                container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except NotFound:
            return None

    def stop(self, user_key: str) -> DockerSandboxResult | None:
        name = self._container_name(user_key)
        try:
            container = self.client.containers.get(name)
            container.stop(timeout=5)
            container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except NotFound:
            return None

    def _create_container(self, user_key: str, name: str) -> DockerSandboxResult:
        workspace = self._workspace_dir(user_key)
        try:
            container = self.client.containers.run(
                image=settings.sandbox_image,
                name=name,
                detach=True,
                tty=True,
                stdin_open=True,
                mem_limit="512m",
                nano_cpus=int(0.5 * 1_000_000_000),
                network=settings.sandbox_network,
                environment=self._sandbox_env(user_key),
                volumes={workspace: {"bind": "/workspace", "mode": "rw"}},
                labels={
                    "app": "openclaw_app",
                    "kind": "sandbox",
                    "user_key": user_key,
                },
            )
            container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except DockerException as exc:
            raise RuntimeError(f"创建沙箱失败: {exc}") from exc
