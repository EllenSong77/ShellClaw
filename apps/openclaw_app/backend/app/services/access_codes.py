from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.activation_code import ActivationCode
from app.models.code_redemption import CodeRedemption
from app.models.enums import Plan, RedeemCodeType, SubscriptionStatus
from app.models.redeem_code import RedeemCode
from app.models.user import User
from app.schemas.access import AccessStatusResponse, RedeemCodeResponse
from app.services.billing import subscription_for_user
from app.services.errors import api_error


def access_status_for_user(user: User, activation_required: bool) -> AccessStatusResponse:
    return AccessStatusResponse(
        activation_required=activation_required,
        is_activated=user.is_activated,
        activated_at=user.activated_at,
    )


def _get_activation_code(db: Session, code_value: str | None) -> ActivationCode | None:
    if not code_value:
        return None
    return db.query(ActivationCode).filter(ActivationCode.code == code_value.strip()).one_or_none()


def _validate_activation_code(code: ActivationCode | None, *, email: str | None, activation_required: bool) -> ActivationCode | None:
    if code is None:
        if activation_required:
            raise api_error(
                403,
                code="ACTIVATION_CODE_REQUIRED",
                message="当前版本需要激活码后才能注册。",
            )
        return None

    now = datetime.now(timezone.utc)
    if not code.enabled:
        raise api_error(403, code="INVALID_ACTIVATION_CODE", message="激活码不可用。")
    if code.expires_at and code.expires_at <= now:
        raise api_error(403, code="ACTIVATION_CODE_EXPIRED", message="激活码已过期。")
    if code.used_count >= code.max_uses:
        raise api_error(403, code="ACTIVATION_CODE_EXHAUSTED", message="激活码已使用完。")
    if email and code.bind_email and code.bind_email.lower() != email.lower():
        raise api_error(403, code="ACTIVATION_CODE_MISMATCH", message="该激活码不适用于当前邮箱。")
    return code


def consume_activation_code(db: Session, code_value: str | None, email: str, activation_required: bool) -> ActivationCode | None:
    code = _get_activation_code(db, code_value)
    if code is None and code_value:
        raise api_error(403, code="INVALID_ACTIVATION_CODE", message="激活码不存在或已失效。")
    code = _validate_activation_code(code, email=email, activation_required=activation_required)
    if code is None:
        return None
    code.used_count += 1
    db.add(code)
    return code


def consume_existing_activation_code(db: Session, code_value: str, user: User) -> ActivationCode:
    code = _get_activation_code(db, code_value)
    if not code_value:
        raise api_error(400, code="INVALID_ACTIVATION_CODE", message="请输入激活码。")
    if code is None:
        raise api_error(403, code="INVALID_ACTIVATION_CODE", message="激活码不存在或已失效。")
    code = _validate_activation_code(code, email=user.email, activation_required=True)
    existing = (
        db.query(CodeRedemption)
        .filter(CodeRedemption.user_id == user.id, CodeRedemption.activation_code_id == code.id)
        .one_or_none()
    )
    if existing is not None:
        raise api_error(409, code="ACTIVATION_CODE_ALREADY_USED", message="你已经使用过这个激活码。")
    code.used_count += 1
    db.add(code)
    return code


def apply_activation_benefits(user: User, code: ActivationCode, *, now: datetime | None = None) -> str:
    current_time = now or datetime.now(timezone.utc)
    if code.target_plan is None:
        return "激活成功，已开通内测访问资格。"

    duration_days = code.duration_days or 30
    if code.target_plan in {Plan.PAID_PERSONAL, Plan.PAID_PRO}:
        base_time = user.paid_until if user.paid_until and user.paid_until > current_time else current_time
        user.plan = code.target_plan
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.subscription_started_at = user.subscription_started_at or current_time
        user.paid_until = base_time + timedelta(days=duration_days)
        return f"激活成功，已开通 {code.display_name or code.target_plan.value}。"

    if code.target_plan == Plan.TRIAL:
        base_time = user.trial_ends_at if user.trial_ends_at and user.trial_ends_at > current_time else current_time
        user.plan = Plan.TRIAL
        user.subscription_status = SubscriptionStatus.TRIALING
        user.trial_ends_at = base_time + timedelta(days=duration_days)
        return f"激活成功，试用期已延长 {duration_days} 天。"

    user.plan = code.target_plan
    return f"激活成功，当前套餐已更新为 {code.display_name or code.target_plan.value}。"


def record_activation_redemption(db: Session, user: User, code: ActivationCode) -> None:
    db.add(
        CodeRedemption(
            user_id=user.id,
            activation_code_id=code.id,
        )
    )


def redeem_code_for_user(db: Session, user: User, code_value: str) -> RedeemCodeResponse:
    normalized = code_value.strip()
    code = db.query(RedeemCode).filter(RedeemCode.code == normalized).one_or_none()
    if code is None:
        activation_code = consume_existing_activation_code(db, normalized, user)
        message = apply_activation_benefits(user, activation_code)
        db.add(user)
        db.add(CodeRedemption(user_id=user.id, activation_code_id=activation_code.id))
        db.commit()
        db.refresh(user)
        return RedeemCodeResponse(
            ok=True,
            code=activation_code.code,
            code_type="activation_code",
            message=message,
            subscription=subscription_for_user(user),
        )

    now = datetime.now(timezone.utc)
    if not code.enabled:
        raise api_error(400, code="REDEEM_CODE_DISABLED", message="兑换码不可用。")
    if code.expires_at and code.expires_at <= now:
        raise api_error(400, code="REDEEM_CODE_EXPIRED", message="兑换码已过期。")
    if code.redeemed_count >= code.max_redemptions:
        raise api_error(400, code="REDEEM_CODE_EXHAUSTED", message="兑换码已被使用完。")

    existing = (
        db.query(CodeRedemption)
        .filter(CodeRedemption.user_id == user.id, CodeRedemption.redeem_code_id == code.id)
        .one_or_none()
    )
    if existing is not None:
        raise api_error(409, code="REDEEM_CODE_ALREADY_USED", message="你已经兑换过这个兑换码。")

    if code.code_type == RedeemCodeType.PLAN_GRANT:
        if code.target_plan is None:
            raise api_error(400, code="REDEEM_CODE_INVALID", message="兑换码套餐配置不完整。")
        duration_days = code.duration_days or 30
        base_time = user.paid_until if user.paid_until and user.paid_until > now else now
        user.plan = code.target_plan
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.subscription_started_at = user.subscription_started_at or now
        user.paid_until = base_time + timedelta(days=duration_days)
        message = f"已兑换 {code.target_plan.value} 套餐。"
    elif code.code_type == RedeemCodeType.TRIAL_EXTEND:
        duration_days = code.duration_days or 7
        base_time = user.trial_ends_at if user.trial_ends_at and user.trial_ends_at > now else now
        user.plan = Plan.TRIAL if user.plan == Plan.FREE else user.plan
        user.subscription_status = SubscriptionStatus.TRIALING if user.plan == Plan.TRIAL else user.subscription_status
        user.trial_ends_at = base_time + timedelta(days=duration_days)
        message = f"试用期已延长 {duration_days} 天。"
    else:
        raise api_error(400, code="REDEEM_CODE_INVALID", message="兑换码类型暂不支持。")

    code.redeemed_count += 1
    db.add(code)
    db.add(user)
    db.add(CodeRedemption(user_id=user.id, redeem_code_id=code.id))
    db.commit()
    db.refresh(user)

    return RedeemCodeResponse(
        ok=True,
        code=code.code,
        code_type=code.code_type,
        message=message,
        subscription=subscription_for_user(user),
    )
