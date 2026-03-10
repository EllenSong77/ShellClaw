import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SandboxStatus

sandbox_status_enum = Enum(
    SandboxStatus,
    name="sandbox_status_enum",
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class Sandbox(Base):
    __tablename__ = "sandboxes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    container_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SandboxStatus] = mapped_column(sandbox_status_enum, default=SandboxStatus.CREATING, nullable=False)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    workspace_size_mb: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="sandboxes")
    tasks = relationship("Task", back_populates="sandbox")
