import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Plan, RedeemCodeType

plan_enum = Enum(Plan, name="plan_enum", values_callable=lambda enum_cls: [item.value for item in enum_cls])
redeem_code_type_enum = Enum(
    RedeemCodeType,
    name="redeem_code_type_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class RedeemCode(Base):
    __tablename__ = "redeem_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    code_type: Mapped[RedeemCodeType] = mapped_column(redeem_code_type_enum, nullable=False)
    target_plan: Mapped[Plan | None] = mapped_column(plan_enum, nullable=True)
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_redemptions: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    redeemed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    redemptions = relationship("CodeRedemption", back_populates="redeem_code")
