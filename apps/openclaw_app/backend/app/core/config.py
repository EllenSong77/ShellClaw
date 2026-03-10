from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ShellClaw API"
    app_env: str = "dev"
    debug: bool = True

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/openclaw_app"
    redis_url: str = "redis://localhost:6379/0"
    litellm_base_url: str = "http://localhost:4000"

    sandbox_image: str = "shellclaw-sandbox:latest"
    sandbox_network: str = "ops_default"
    sandbox_workspace_root: str = "/tmp/openclaw_app/workspaces"
    sandbox_task_mode: str = "openclaw"
    sandbox_command_template: str = "bash -lc 'set -o pipefail; /home/es/.npm-global/bin/openclaw agent --local --agent main --message \"{message}\" --json --timeout 120 | python3 -c \"import sys; data=sys.stdin.read(); start=data.rfind(\\\"{{\\\"); print(data[start:] if start != -1 else data)\"'"
    free_daily_task_limit: int = 5
    sandbox_idle_pause_minutes: int = 15
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    task_events_channel_prefix: str = "task-events"
    cors_allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
