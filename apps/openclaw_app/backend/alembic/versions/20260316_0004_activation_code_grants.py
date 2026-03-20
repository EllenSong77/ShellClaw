"""activation code grants"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260316_0004"
down_revision = "20260311_0003"
branch_labels = None
depends_on = None


plan_enum_column = postgresql.ENUM("trial", "free", "paid_personal", "paid_pro", name="plan_enum", create_type=False)


def upgrade() -> None:
    op.add_column("activation_codes", sa.Column("target_plan", plan_enum_column, nullable=True))
    op.add_column("activation_codes", sa.Column("duration_days", sa.Integer(), nullable=True))
    op.add_column("activation_codes", sa.Column("display_name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("activation_codes", "display_name")
    op.drop_column("activation_codes", "duration_days")
    op.drop_column("activation_codes", "target_plan")
