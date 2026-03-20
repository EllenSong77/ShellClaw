from datetime import datetime

from pydantic import BaseModel

from app.models.enums import RedeemCodeType
from app.schemas.billing import SubscriptionResponse


class AccessConfigResponse(BaseModel):
    activation_required: bool


class AccessStatusResponse(BaseModel):
    activation_required: bool
    is_activated: bool
    activated_at: datetime | None


class RedeemCodeRequest(BaseModel):
    code: str


class RedeemCodeResponse(BaseModel):
    ok: bool
    code: str
    code_type: RedeemCodeType | str
    message: str
    subscription: SubscriptionResponse
