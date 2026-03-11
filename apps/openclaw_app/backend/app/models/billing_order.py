import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import BillingOrderStatus, BillingProvider, Plan

plan_enum = Enum(Plan, name="plan_enum", values_callable=lambda enum_cls: [item.value for item in enum_cls])
billing_provider_enum = Enum(
    BillingProvider,
    name="billing_provider_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)
billing_order_status_enum = Enum(
    BillingOrderStatus,
    name="billing_order_status_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class BillingOrder(Base):
    __tablename__ = "billing_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan: Mapped[Plan] = mapped_column(plan_enum, nullable=False)
    provider: Mapped[BillingProvider] = mapped_column(billing_provider_enum, nullable=False, default=BillingProvider.MOCK)
    status: Mapped[BillingOrderStatus] = mapped_column(
        billing_order_status_enum,
        nullable=False,
        default=BillingOrderStatus.PENDING,
    )
    amount_cny: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="CNY")
    external_order_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="billing_orders")
