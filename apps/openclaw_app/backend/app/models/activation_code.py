import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Plan

plan_enum = Enum(Plan, name="plan_enum", values_callable=lambda enum_cls: [item.value for item in enum_cls])


class ActivationCode(Base):
    __tablename__ = "activation_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bind_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_plan: Mapped[Plan | None] = mapped_column(plan_enum, nullable=True)
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    users = relationship("User", back_populates="activation_code")
    redemptions = relationship("CodeRedemption", back_populates="activation_code")
