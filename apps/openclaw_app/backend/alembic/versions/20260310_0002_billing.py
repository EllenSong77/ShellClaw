"""billing schema"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260310_0002"
down_revision = "20260310_0001"
branch_labels = None
depends_on = None


subscription_status_enum = sa.Enum(
    "trialing", "active", "past_due", "canceled", "expired", name="subscription_status_enum"
)
billing_provider_enum = sa.Enum("mock", "stripe", "alipay", "wechat", name="billing_provider_enum")
billing_order_status_enum = sa.Enum("pending", "paid", "failed", "cancelled", "refunded", name="billing_order_status_enum")
subscription_status_enum_column = postgresql.ENUM(
    "trialing", "active", "past_due", "canceled", "expired", name="subscription_status_enum", create_type=False
)
billing_provider_enum_column = postgresql.ENUM(
    "mock", "stripe", "alipay", "wechat", name="billing_provider_enum", create_type=False
)
billing_order_status_enum_column = postgresql.ENUM(
    "pending", "paid", "failed", "cancelled", "refunded", name="billing_order_status_enum", create_type=False
)
plan_enum_column = postgresql.ENUM("trial", "free", "paid_personal", "paid_pro", name="plan_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    subscription_status_enum.create(bind, checkfirst=True)
    billing_provider_enum.create(bind, checkfirst=True)
    billing_order_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column("subscription_status", subscription_status_enum_column, nullable=False, server_default="trialing"),
    )
    op.add_column("users", sa.Column("subscription_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("billing_provider", billing_provider_enum_column, nullable=True))
    op.add_column("users", sa.Column("billing_customer_id", sa.Text(), nullable=True))

    op.create_table(
        "billing_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", plan_enum_column, nullable=False),
        sa.Column("provider", billing_provider_enum_column, nullable=False, server_default="mock"),
        sa.Column("status", billing_order_status_enum_column, nullable=False, server_default="pending"),
        sa.Column("amount_cny", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.Text(), nullable=False, server_default="CNY"),
        sa.Column("external_order_id", sa.Text(), nullable=True),
        sa.Column("checkout_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_billing_orders_user_created", "billing_orders", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_billing_orders_user_created", table_name="billing_orders")
    op.drop_table("billing_orders")

    op.drop_column("users", "billing_customer_id")
    op.drop_column("users", "billing_provider")
    op.drop_column("users", "cancel_at_period_end")
    op.drop_column("users", "subscription_started_at")
    op.drop_column("users", "subscription_status")

    bind = op.get_bind()
    billing_order_status_enum.drop(bind, checkfirst=True)
    billing_provider_enum.drop(bind, checkfirst=True)
    subscription_status_enum.drop(bind, checkfirst=True)
