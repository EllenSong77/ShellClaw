from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "OpenClaw App API"
    app_env: str = "dev"
    debug: bool = True

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/openclaw_app"
    redis_url: str = "redis://localhost:6379/0"
    litellm_base_url: str = "http://localhost:4000"

    sandbox_image: str = "openclaw-app-sandbox:latest"
    sandbox_network: str = "openclaw_app_default"
    sandbox_workspace_root: str = "/tmp/openclaw_app/workspaces"
    free_daily_task_limit: int = 5
    sandbox_idle_pause_minutes: int = 15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
