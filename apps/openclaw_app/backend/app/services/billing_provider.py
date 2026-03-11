from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Protocol

from app.models.enums import BillingProvider, Plan
from app.models.user import User


@dataclass(frozen=True)
class CheckoutSession:
    provider: BillingProvider
    amount_cny: Decimal
    currency: str
    external_order_id: str
    checkout_url: str | None
    mock: bool


class BillingProviderAdapter(Protocol):
    provider: BillingProvider

    def create_checkout(
        self,
        *,
        user: User,
        plan: Plan,
        amount_cny: Decimal,
        success_url: str | None,
        cancel_url: str | None,
    ) -> CheckoutSession: ...

    def portal_url(self, *, user: User) -> str: ...


class MockBillingProvider:
    provider = BillingProvider.MOCK

    def create_checkout(
        self,
        *,
        user: User,
        plan: Plan,
        amount_cny: Decimal,
        success_url: str | None,
        cancel_url: str | None,
    ) -> CheckoutSession:
        external_order_id = f"mock_{user.id}_{int(datetime.now(timezone.utc).timestamp())}"
        fallback_url = success_url or cancel_url or "/account"
        checkout_url = f"{fallback_url}{'&' if '?' in fallback_url else '?'}provider=mock"
        return CheckoutSession(
            provider=self.provider,
            amount_cny=amount_cny,
            currency="CNY",
            external_order_id=external_order_id,
            checkout_url=checkout_url,
            mock=True,
        )

    def portal_url(self, *, user: User) -> str:
        return f"/account/billing?provider={self.provider}&user_id={user.id}"


def get_billing_provider(provider: BillingProvider) -> BillingProviderAdapter:
    if provider == BillingProvider.MOCK:
        return MockBillingProvider()
    raise NotImplementedError(f"billing provider {provider} not implemented")
