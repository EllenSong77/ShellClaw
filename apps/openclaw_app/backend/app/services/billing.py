from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.billing_order import BillingOrder
from app.models.enums import BillingOrderStatus, BillingProvider, Plan, SubscriptionStatus
from app.models.user import User
from app.schemas.billing import (
    BillingOrderResponse,
    BillingSummaryResponse,
    CheckoutResponse,
    PlanFeatureResponse,
    SubscriptionResponse,
)
from app.services.billing_provider import get_billing_provider


@dataclass(frozen=True)
class PlanSpec:
    label: str
    price_month_cny: Decimal
    task_limit_daily: int | None
    max_concurrency: int
    workspace_limit_mb: int
    sandbox_timeout_minutes: int
    highlighted: bool = False


PLAN_SPECS: dict[Plan, PlanSpec] = {
    Plan.FREE: PlanSpec("Free", Decimal("0"), 5, 1, 256, 15),
    Plan.TRIAL: PlanSpec("Trial", Decimal("0"), None, 1, 512, 30, highlighted=True),
    Plan.PAID_PERSONAL: PlanSpec("Personal", Decimal("39"), None, 2, 2048, 60, highlighted=True),
    Plan.PAID_PRO: PlanSpec("Pro", Decimal("99"), None, 4, 10240, 180),
}


def serialize_plan_specs() -> list[PlanFeatureResponse]:
    ordered = [Plan.FREE, Plan.PAID_PERSONAL, Plan.PAID_PRO]
    return [
        PlanFeatureResponse(
            plan=plan,
            label=spec.label,
            price_month_cny=spec.price_month_cny,
            task_limit_daily=spec.task_limit_daily,
            max_concurrency=spec.max_concurrency,
            workspace_limit_mb=spec.workspace_limit_mb,
            sandbox_timeout_minutes=spec.sandbox_timeout_minutes,
            highlighted=spec.highlighted,
        )
        for plan, spec in ((plan, PLAN_SPECS[plan]) for plan in ordered)
    ]


def subscription_for_user(user: User) -> SubscriptionResponse:
    now = datetime.now(timezone.utc)
    trial_days_remaining = None
    if user.plan == Plan.TRIAL and user.trial_ends_at:
        delta = user.trial_ends_at - now
        trial_days_remaining = max(0, delta.days + (1 if delta.seconds > 0 else 0))

    return SubscriptionResponse(
        plan=user.plan,
        subscription_status=user.subscription_status,
        trial_ends_at=user.trial_ends_at,
        paid_until=user.paid_until,
        subscription_started_at=user.subscription_started_at,
        cancel_at_period_end=user.cancel_at_period_end,
        billing_provider=user.billing_provider,
        billing_customer_id=user.billing_customer_id,
        current_period_ends_at=user.paid_until or user.trial_ends_at,
        is_paid=user.plan in {Plan.PAID_PERSONAL, Plan.PAID_PRO}
        and user.subscription_status == SubscriptionStatus.ACTIVE,
        trial_days_remaining=trial_days_remaining,
        plans=serialize_plan_specs(),
    )


def billing_summary_for_user(db: Session, user: User) -> BillingSummaryResponse:
    orders = (
        db.query(BillingOrder)
        .filter(BillingOrder.user_id == user.id)
        .order_by(BillingOrder.created_at.desc())
        .limit(10)
        .all()
    )
    return BillingSummaryResponse(subscription=subscription_for_user(user), recent_orders=orders)


def list_orders_for_user(db: Session, user: User) -> list[BillingOrder]:
    return (
        db.query(BillingOrder)
        .filter(BillingOrder.user_id == user.id)
        .order_by(BillingOrder.created_at.desc())
        .all()
    )


def create_mock_checkout(
    db: Session,
    user: User,
    plan: Plan,
    provider: BillingProvider,
    success_url: str | None,
    cancel_url: str | None,
) -> CheckoutResponse:
    spec = PLAN_SPECS[plan]
    provider_adapter = get_billing_provider(provider)
    checkout = provider_adapter.create_checkout(
        user=user,
        plan=plan,
        amount_cny=spec.price_month_cny,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    order = BillingOrder(
        user_id=user.id,
        plan=plan,
        provider=checkout.provider,
        status=BillingOrderStatus.PENDING,
        amount_cny=checkout.amount_cny,
        currency=checkout.currency,
        external_order_id=checkout.external_order_id,
        checkout_url=checkout.checkout_url,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    if order.checkout_url:
        separator = '&' if '?' in order.checkout_url else '?'
        order.checkout_url = f"{order.checkout_url}{separator}mock_order_id={order.id}"
    db.add(order)
    db.commit()
    db.refresh(order)

    return CheckoutResponse(
        ok=True,
        order=order,
        checkout_url=order.checkout_url,
        provider=checkout.provider,
        mock=checkout.mock,
    )


def portal_url_for_user(user: User) -> tuple[BillingProvider, str]:
    provider = user.billing_provider or BillingProvider.MOCK
    provider_adapter = get_billing_provider(provider)
    return provider, provider_adapter.portal_url(user=user)


def mark_order_paid(db: Session, user: User, order: BillingOrder) -> BillingOrderResponse:
    now = datetime.now(timezone.utc)
    order.status = BillingOrderStatus.PAID
    order.paid_at = now

    user.plan = order.plan
    user.subscription_status = SubscriptionStatus.ACTIVE
    user.subscription_started_at = now
    user.paid_until = now + timedelta(days=30)
    user.billing_provider = order.provider

    db.add(order)
    db.add(user)
    db.commit()
    db.refresh(order)
    db.refresh(user)
    return BillingOrderResponse.model_validate(order)


def mark_order_failed(db: Session, order: BillingOrder) -> BillingOrderResponse:
    order.status = BillingOrderStatus.FAILED
    db.add(order)
    db.commit()
    db.refresh(order)
    return BillingOrderResponse.model_validate(order)


def mark_order_cancelled(db: Session, order: BillingOrder) -> BillingOrderResponse:
    order.status = BillingOrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    db.add(order)
    db.commit()
    db.refresh(order)
    return BillingOrderResponse.model_validate(order)
