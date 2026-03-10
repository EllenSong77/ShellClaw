from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.enums import Plan
from app.models.user import User


def normalize_user_plan(db: Session, user: User) -> User:
    now = datetime.now(timezone.utc)
    updated = False

    if user.plan == Plan.TRIAL and user.trial_ends_at and user.trial_ends_at <= now:
        user.plan = Plan.FREE
        updated = True

    if user.plan in {Plan.PAID_PERSONAL, Plan.PAID_PRO} and user.paid_until and user.paid_until <= now:
        user.plan = Plan.FREE
        updated = True

    if updated:
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
