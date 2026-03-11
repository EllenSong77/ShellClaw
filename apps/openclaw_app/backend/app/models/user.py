import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import BillingProvider, Plan, SubscriptionStatus

plan_enum = Enum(Plan, name="plan_enum", values_callable=lambda enum_cls: [item.value for item in enum_cls])
subscription_status_enum = Enum(
    SubscriptionStatus,
    name="subscription_status_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)
billing_provider_enum = Enum(
    BillingProvider,
    name="billing_provider_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[Plan] = mapped_column(plan_enum, default=Plan.TRIAL, nullable=False)
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        subscription_status_enum,
        default=SubscriptionStatus.TRIALING,
        nullable=False,
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    billing_provider: Mapped[BillingProvider | None] = mapped_column(billing_provider_enum, nullable=True)
    billing_customer_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sandboxes = relationship("Sandbox", back_populates="user")
    tasks = relationship("Task", back_populates="user")
    billing_orders = relationship("BillingOrder", back_populates="user")
