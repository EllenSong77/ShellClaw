"""initial schema"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260310_0001"
down_revision = None
branch_labels = None
depends_on = None


plan_enum = sa.Enum("trial", "free", "paid_personal", "paid_pro", name="plan_enum")
sandbox_status_enum = sa.Enum("creating", "running", "paused", "stopped", "archived", name="sandbox_status_enum")
task_status_enum = sa.Enum("running", "completed", "timeout", "error", "cancelled", name="task_status_enum")
plan_enum_column = postgresql.ENUM("trial", "free", "paid_personal", "paid_pro", name="plan_enum", create_type=False)
sandbox_status_enum_column = postgresql.ENUM(
    "creating", "running", "paused", "stopped", "archived", name="sandbox_status_enum", create_type=False
)
task_status_enum_column = postgresql.ENUM(
    "running", "completed", "timeout", "error", "cancelled", name="task_status_enum", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    plan_enum.create(bind, checkfirst=True)
    sandbox_status_enum.create(bind, checkfirst=True)
    task_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("plan", plan_enum_column, nullable=False, server_default="trial"),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "sandboxes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("container_id", sa.Text(), nullable=True),
        sa.Column("status", sandbox_status_enum_column, nullable=False, server_default="creating"),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("workspace_size_mb", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("sandbox_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sandboxes.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("status", task_status_enum_column, nullable=True),
        sa.Column("model_name", sa.Text(), nullable=True),
        sa.Column("llm_calls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stdout_text", sa.Text(), nullable=True),
        sa.Column("stderr_text", sa.Text(), nullable=True),
        sa.Column("error_text", sa.Text(), nullable=True),
        sa.Column("cost_cny", sa.Numeric(10, 4), nullable=False, server_default="0"),
    )

    op.create_table(
        "daily_usage",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
        sa.Column("date", sa.Date(), primary_key=True, nullable=False),
        sa.Column("task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_cny", sa.Numeric(10, 4), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("daily_usage")
    op.drop_table("tasks")
    op.drop_table("sandboxes")
    op.drop_table("users")

    bind = op.get_bind()
    task_status_enum.drop(bind, checkfirst=True)
    sandbox_status_enum.drop(bind, checkfirst=True)
    plan_enum.drop(bind, checkfirst=True)
