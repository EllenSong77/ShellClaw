"""activation and redeem codes"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260311_0003"
down_revision = "20260310_0002"
branch_labels = None
depends_on = None


redeem_code_type_enum = sa.Enum("plan_grant", "trial_extend", name="redeem_code_type_enum")
redeem_code_type_enum_column = postgresql.ENUM(
    "plan_grant",
    "trial_extend",
    name="redeem_code_type_enum",
    create_type=False,
)
plan_enum_column = postgresql.ENUM("trial", "free", "paid_personal", "paid_pro", name="plan_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    redeem_code_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "activation_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bind_email", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "redeem_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("code_type", redeem_code_type_enum_column, nullable=False),
        sa.Column("target_plan", plan_enum_column, nullable=True),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("max_redemptions", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("redeemed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code"),
    )

    op.add_column("users", sa.Column("is_activated", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("activation_code_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE users SET activated_at = created_at WHERE is_activated = true AND activated_at IS NULL")
    op.create_foreign_key("fk_users_activation_code_id", "users", "activation_codes", ["activation_code_id"], ["id"])

    op.create_table(
        "code_redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("activation_code_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activation_codes.id"), nullable=True),
        sa.Column("redeem_code_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("redeem_codes.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_code_redemptions_user_created", "code_redemptions", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_code_redemptions_user_created", table_name="code_redemptions")
    op.drop_table("code_redemptions")

    op.drop_constraint("fk_users_activation_code_id", "users", type_="foreignkey")
    op.drop_column("users", "activation_code_id")
    op.drop_column("users", "activated_at")
    op.drop_column("users", "is_activated")

    op.drop_table("redeem_codes")
    op.drop_table("activation_codes")

    bind = op.get_bind()
    redeem_code_type_enum.drop(bind, checkfirst=True)
