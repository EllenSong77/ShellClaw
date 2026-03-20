from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Protocol
import hashlib
import hmac

import httpx

from app.core.config import settings
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


class StripeBillingProvider:
    provider = BillingProvider.STRIPE
    api_base = "https://api.stripe.com/v1"

    def _auth_headers(self) -> dict[str, str]:
        if not settings.stripe_secret_key:
            raise NotImplementedError("stripe secret key not configured")
        return {"Authorization": f"Bearer {settings.stripe_secret_key}"}

    def create_checkout(
        self,
        *,
        user: User,
        plan: Plan,
        amount_cny: Decimal,
        success_url: str | None,
        cancel_url: str | None,
    ) -> CheckoutSession:
        success = success_url or "/account?checkout=success"
        cancel = cancel_url or "/pricing?checkout=cancelled"
        payload = {
            "mode": "payment",
            "success_url": success,
            "cancel_url": cancel,
            "client_reference_id": str(user.id),
            "customer_email": user.email,
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": "cny",
            "line_items[0][price_data][unit_amount]": str(int(amount_cny * 100)),
            "line_items[0][price_data][product_data][name]": f"ShellClaw {plan.value}",
            "metadata[user_id]": str(user.id),
            "metadata[plan]": plan.value,
        }
        response = httpx.post(
            f"{self.api_base}/checkout/sessions",
            data=payload,
            headers=self._auth_headers(),
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return CheckoutSession(
            provider=self.provider,
            amount_cny=amount_cny,
            currency=(data.get("currency") or "cny").upper(),
            external_order_id=data["id"],
            checkout_url=data.get("url"),
            mock=False,
        )

    def portal_url(self, *, user: User) -> str:
        if not user.billing_customer_id:
            raise NotImplementedError("stripe billing customer missing")
        response = httpx.post(
            f"{self.api_base}/billing_portal/sessions",
            data={
                "customer": user.billing_customer_id,
                "return_url": "/account/billing",
            },
            headers=self._auth_headers(),
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return data["url"]


def verify_stripe_signature(payload: bytes, signature_header: str | None) -> bool:
    if not settings.stripe_webhook_secret or not signature_header:
        return False
    components = {}
    for part in signature_header.split(","):
        if "=" in part:
            key, value = part.split("=", 1)
            components[key] = value
    timestamp = components.get("t")
    signature = components.get("v1")
    if not timestamp or not signature:
        return False
    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(
        settings.stripe_webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_billing_provider(provider: BillingProvider) -> BillingProviderAdapter:
    if provider == BillingProvider.MOCK:
        return MockBillingProvider()
    if provider == BillingProvider.STRIPE:
        return StripeBillingProvider()
    raise NotImplementedError(f"billing provider {provider} not implemented")
