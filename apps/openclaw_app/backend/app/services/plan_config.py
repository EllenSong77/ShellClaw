from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.models.enums import Plan


@dataclass(frozen=True)
class PlanSpec:
    plan: Plan
    label: str
    price_month_cny: Decimal
    task_limit_daily: int | None
    max_concurrency: int
    workspace_limit_mb: int
    sandbox_timeout_minutes: int
    highlighted: bool = False
    enabled: bool = True
    available_for_checkout: bool = False


def _config_path() -> Path:
    return Path(settings.plans_config_path)


@lru_cache(maxsize=1)
def load_plan_specs() -> dict[Plan, PlanSpec]:
    payload = json.loads(_config_path().read_text(encoding="utf-8"))
    plans = {}
    for item in payload.get("plans", []):
        plan = Plan(item["plan"])
        plans[plan] = PlanSpec(
            plan=plan,
            label=item["label"],
            price_month_cny=Decimal(str(item["price_month_cny"])),
            task_limit_daily=item.get("task_limit_daily"),
            max_concurrency=item["max_concurrency"],
            workspace_limit_mb=item["workspace_limit_mb"],
            sandbox_timeout_minutes=item["sandbox_timeout_minutes"],
            highlighted=item.get("highlighted", False),
            enabled=item.get("enabled", True),
            available_for_checkout=item.get("available_for_checkout", False),
        )
    return plans


def get_plan_spec(plan: Plan) -> PlanSpec:
    specs = load_plan_specs()
    if plan not in specs:
        raise KeyError(f"plan {plan.value} not found in config")
    return specs[plan]


def listed_plan_specs() -> list[PlanSpec]:
    specs = load_plan_specs()
    ordered = [Plan.FREE, Plan.PAID_PERSONAL, Plan.PAID_PRO]
    return [specs[plan] for plan in ordered if plan in specs and specs[plan].enabled]
