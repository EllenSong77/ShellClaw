from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import BillingOrderStatus, BillingProvider, Plan, SubscriptionStatus


class PlanFeatureResponse(BaseModel):
    plan: Plan
    label: str
    price_month_cny: Decimal
    task_limit_daily: int | None
    max_concurrency: int
    workspace_limit_mb: int
    sandbox_timeout_minutes: int
    highlighted: bool = False


class SubscriptionResponse(BaseModel):
    plan: Plan
    subscription_status: SubscriptionStatus
    trial_ends_at: datetime | None
    paid_until: datetime | None
    subscription_started_at: datetime | None
    cancel_at_period_end: bool
    billing_provider: BillingProvider | None
    billing_customer_id: str | None
    current_period_ends_at: datetime | None
    is_paid: bool
    trial_days_remaining: int | None
    plans: list[PlanFeatureResponse]


class BillingOrderResponse(BaseModel):
    id: UUID
    plan: Plan
    provider: BillingProvider
    status: BillingOrderStatus
    amount_cny: Decimal
    currency: str
    external_order_id: str | None
    checkout_url: str | None
    created_at: datetime
    paid_at: datetime | None
    cancelled_at: datetime | None

    model_config = {
        "from_attributes": True,
    }


class BillingSummaryResponse(BaseModel):
    subscription: SubscriptionResponse
    recent_orders: list[BillingOrderResponse]


class BillingOrdersResponse(BaseModel):
    items: list[BillingOrderResponse]


class CheckoutRequest(BaseModel):
    plan: Plan
    provider: BillingProvider | None = None
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutResponse(BaseModel):
    ok: bool
    order: BillingOrderResponse
    checkout_url: str | None
    provider: BillingProvider
    mock: bool


class BillingPortalResponse(BaseModel):
    ok: bool
    url: str
    provider: BillingProvider


class BillingConfigResponse(BaseModel):
    default_provider: BillingProvider
    stripe_enabled: bool
    stripe_publishable_key: str | None
