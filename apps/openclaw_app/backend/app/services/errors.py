from __future__ import annotations

from fastapi import HTTPException

from app.models.enums import Plan


def api_error(
    status_code: int,
    *,
    code: str,
    message: str,
    upgrade_required: bool = False,
    current_plan: Plan | None = None,
    suggested_plan: Plan | None = None,
    redirect_to: str | None = None,
    action: str | None = None,
) -> HTTPException:
    detail = {
        "code": code,
        "message": message,
        "upgrade_required": upgrade_required,
    }
    if current_plan is not None:
        detail["current_plan"] = current_plan
    if suggested_plan is not None:
        detail["suggested_plan"] = suggested_plan
    if redirect_to is not None:
        detail["redirect_to"] = redirect_to
    if action is not None:
        detail["action"] = action
    return HTTPException(status_code=status_code, detail=detail)
