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
    HOST_NODE_PATH = Path("/usr/bin/node")
    HOST_NPM_GLOBAL = Path("/home/es/.npm-global")
    HOST_OPENCLAW_HOME = Path("/home/es/.openclaw")
    SANDBOX_HOME = "/workspace/home"
    SANDBOX_OPENCLAW_SEED = "/seed-openclaw"

    def __init__(self) -> None:
        self.client = docker.from_env()

    @staticmethod
    def _legacy_container_name(user_key: str) -> str:
        safe = user_key.replace('@', '-at-').replace('.', '-').replace('_', '-')
        return f"openclaw-sbx-{safe}"

    def _container_name(self, user_key: str) -> str:
        safe = user_key.replace('@', '-at-').replace('.', '-').replace('_', '-')
        return f"shellclaw-sbx-{safe}"

    def _workspace_dir(self, user_key: str) -> str:
        root = Path("/tmp/openclaw_app/workspaces")
        root.mkdir(parents=True, exist_ok=True)
        target = root / user_key
        target.mkdir(parents=True, exist_ok=True)
        return str(target)

    def _sandbox_env(self, user_key: str) -> dict[str, str]:
        env = {
            "LITELLM_BASE_URL": settings.litellm_base_url,
            "LITELLM_API_KEY": "shellclaw-local",
            "OPENCLAW_TASK_MODE": settings.sandbox_task_mode,
            "OPENCLAW_USER_KEY": user_key,
            "OPENCLAW_TASK_COMMAND_TEMPLATE": settings.sandbox_command_template,
            "PATH": "/home/es/.npm-global/bin:/usr/local/bin:/usr/bin:/bin",
            "HOME": self.SANDBOX_HOME,
            "OPENCLAW_HOME_SEED": self.SANDBOX_OPENCLAW_SEED,
            "NODE_OPTIONS": "--max-old-space-size=1536",
        }
        for key in self.PASSTHROUGH_ENV_KEYS:
            value = os.getenv(key)
            if value:
                env[key] = value
        return env

    def _sandbox_volumes(self, user_key: str) -> dict[str, dict[str, str]]:
        workspace = self._workspace_dir(user_key)
        volumes: dict[str, dict[str, str]] = {
            workspace: {"bind": "/workspace", "mode": "rw"},
            str(self.HOST_NODE_PATH): {"bind": "/usr/local/bin/node", "mode": "ro"},
            str(self.HOST_NPM_GLOBAL): {"bind": "/home/es/.npm-global", "mode": "ro"},
            str(self.HOST_OPENCLAW_HOME): {"bind": self.SANDBOX_OPENCLAW_SEED, "mode": "ro"},
        }

        return volumes

    def _get_container(self, user_key: str):
        for name in (self._container_name(user_key), self._legacy_container_name(user_key)):
            try:
                return self.client.containers.get(name)
            except NotFound:
                continue
        raise NotFound("sandbox container not found")

    def _container_matches_settings(self, container, user_key: str) -> bool:
        container.reload()
        attrs = getattr(container, 'attrs', {}) or {}
        config = attrs.get('Config', {}) or {}
        env_list = config.get('Env', []) or []
        env_map: dict[str, str] = {}
        for item in env_list:
            if '=' not in item:
                continue
            key, value = item.split('=', 1)
            env_map[key] = value

        expected = self._sandbox_env(user_key)
        for key in ('OPENCLAW_TASK_MODE', 'LITELLM_BASE_URL', 'HOME', 'OPENCLAW_HOME_SEED'):
            if env_map.get(key) != expected.get(key):
                return False

        return container.name == self._container_name(user_key)

    def _recreate_container(self, container, user_key: str) -> DockerSandboxResult:
        try:
            container.remove(force=True)
        except DockerException:
            pass
        return self._create_container(user_key, self._container_name(user_key))

    def ensure_running(self, user_key: str) -> DockerSandboxResult:
        try:
            container = self._get_container(user_key)
            if not self._container_matches_settings(container, user_key):
                return self._recreate_container(container, user_key)
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
            return self._create_container(user_key, self._container_name(user_key))

    def pause(self, user_key: str) -> DockerSandboxResult | None:
        try:
            container = self._get_container(user_key)
            container.reload()
            if container.status == "running":
                container.pause()
                container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except NotFound:
            return None

    def stop(self, user_key: str) -> DockerSandboxResult | None:
        try:
            container = self._get_container(user_key)
            container.stop(timeout=5)
            container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except NotFound:
            return None

    def _create_container(self, user_key: str, name: str) -> DockerSandboxResult:
        try:
            container = self.client.containers.run(
                image=settings.sandbox_image,
                name=name,
                detach=True,
                tty=True,
                stdin_open=True,
                mem_limit="2g",
                nano_cpus=int(0.5 * 1_000_000_000),
                network=settings.sandbox_network,
                environment=self._sandbox_env(user_key),
                volumes=self._sandbox_volumes(user_key),
                labels={
                    "app": "shellclaw_app",
                    "kind": "sandbox",
                    "user_key": user_key,
                },
            )
            container.reload()
            return DockerSandboxResult(container_id=container.id, status=container.status)
        except DockerException as exc:
            raise RuntimeError(f"创建沙箱失败: {exc}") from exc
