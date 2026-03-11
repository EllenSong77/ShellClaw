from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from mimetypes import guess_type
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from redis import Redis
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import SessionLocal, get_db
from app.models.billing_order import BillingOrder
from app.models.enums import BillingOrderStatus, BillingProvider, Plan, SandboxStatus, TaskStatus
from app.models.task import Task
from app.models.user import User
from app.schemas.billing import (
    BillingOrdersResponse,
    BillingPortalResponse,
    BillingSummaryResponse,
    CheckoutRequest,
    CheckoutResponse,
    SubscriptionResponse,
)
from app.schemas.file import WorkspaceEntry, WorkspaceListResponse
from app.schemas.task import TaskResponse
from app.schemas.task_list import TaskListResponse
from app.schemas.user import (
    LoginRequest,
    RegisterRequest,
    SandboxResponse,
    TokenResponse,
    UsageResponse,
    UserResponse,
)
from app.services.auth import get_current_user
from app.services.billing import (
    billing_summary_for_user,
    create_mock_checkout,
    list_orders_for_user,
    mark_order_cancelled,
    mark_order_failed,
    mark_order_paid,
    portal_url_for_user,
    subscription_for_user,
)
from app.services.docker_sandbox import DockerSandboxManager
from app.services.errors import api_error
from app.services.events import TaskEventPublisher, user_events_channel
from app.services.quota import QuotaExceededError, QuotaService
from app.services.sandbox import SandboxService
from app.services.task_queue import TaskQueueService
from app.services.user_plan import normalize_user_plan
from app.services.workspace import WorkspaceService

router = APIRouter()


class TaskCreateRequest(BaseModel):
    message: str
    command: str | list[str] | None = None
    timeout_sec: int | None = None


def redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def get_usage_for_user(user: User) -> UsageResponse:
    client = redis_client()
    now = datetime.now(timezone.utc)
    key = QuotaService(client)._key(str(user.id), now)
    daily_used = int(client.get(key) or 0)
    daily_limit = settings.free_daily_task_limit if user.plan == Plan.FREE else None
    daily_remaining = None if daily_limit is None else max(0, daily_limit - daily_used)
    return UsageResponse(
        plan=user.plan,
        trial_ends_at=user.trial_ends_at,
        paid_until=user.paid_until,
        daily_used=daily_used,
        daily_limit=daily_limit,
        daily_remaining=daily_remaining,
    )


def create_task_for_user(db: Session, user: User, payload: TaskCreateRequest) -> dict:
    user = normalize_user_plan(db, user)
    client = redis_client()
    if user.plan == Plan.FREE and payload.command:
        raise api_error(
            403,
            code="PLAN_UPGRADE_REQUIRED",
            message="当前套餐不支持高级任务能力，请升级后继续使用。",
            upgrade_required=True,
            current_plan=user.plan,
            suggested_plan=Plan.PAID_PERSONAL,
            redirect_to="/pricing",
            action="upgrade",
        )
    try:
        QuotaService(client).check_and_consume(str(user.id), user.plan, user.subscription_status)
    except QuotaExceededError as exc:
        raise api_error(
            429,
            code=exc.code,
            message=exc.message,
            upgrade_required=exc.upgrade_required,
            current_plan=user.plan,
            suggested_plan=exc.suggested_plan,
            redirect_to=exc.redirect_to,
            action=exc.action,
        ) from exc

    sandbox_service = SandboxService(db)
    sandbox_service.pause_idle_sandboxes()
    sandbox = sandbox_service.ensure_for_user(user)
    result = DockerSandboxManager().ensure_running(str(user.id))
    sandbox = sandbox_service.mark_running(sandbox, result.container_id)

    task = Task(
        user_id=user.id,
        sandbox_id=sandbox.id,
        status=TaskStatus.RUNNING,
        model_name='default',
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    payload_for_queue = {
        'task_id': str(task.id),
        'user_id': str(user.id),
        'sandbox_id': str(sandbox.id),
        'container_id': sandbox.container_id,
        'queue': TaskQueueService.queue_for_plan(user.plan),
        'message': payload.message,
        'command': payload.command,
        'timeout_sec': payload.timeout_sec,
    }
    queue_name = TaskQueueService(client).enqueue(payload_for_queue, user.plan)

    TaskEventPublisher(client).publish(
        str(user.id),
        {
            'type': 'task_enqueued',
            'task_id': str(task.id),
            'status': TaskStatus.RUNNING,
            'queue': queue_name,
        },
    )

    return {
        'ok': True,
        'task_id': str(task.id),
        'queue': queue_name,
        'sandbox_status': sandbox.status,
        'container_id': sandbox.container_id,
    }


@router.get('/healthz')
def healthz():
    return {'ok': True, 'service': settings.app_name}


@router.post('/auth/register', response_model=UserResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail='邮箱已存在')

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=7),
        last_active_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    SandboxService(db).ensure_for_user(user)
    return user


@router.post('/auth/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='邮箱或密码错误')

    token = create_access_token(subject=str(user.id), extra_claims={'email': user.email})
    return TokenResponse(access_token=token)


@router.get('/me', response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get('/me/usage', response_model=UsageResponse)
def my_usage(current_user: User = Depends(get_current_user)):
    return get_usage_for_user(current_user)


@router.get('/me/subscription', response_model=SubscriptionResponse)
def get_my_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = normalize_user_plan(db, current_user)
    return subscription_for_user(user)


@router.get('/me/billing', response_model=BillingSummaryResponse)
def get_my_billing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = normalize_user_plan(db, current_user)
    return billing_summary_for_user(db, user)


@router.get('/me/orders', response_model=BillingOrdersResponse)
def get_my_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = normalize_user_plan(db, current_user)
    return BillingOrdersResponse(items=list_orders_for_user(db, user))


@router.post('/billing/checkout', response_model=CheckoutResponse)
def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.plan in {Plan.FREE, Plan.TRIAL}:
        raise api_error(
            400,
            code="INVALID_BILLING_PLAN",
            message="请选择付费套餐。",
            current_plan=current_user.plan,
            suggested_plan=Plan.PAID_PERSONAL,
            redirect_to="/pricing",
            action="upgrade",
        )
    user = normalize_user_plan(db, current_user)
    try:
        return create_mock_checkout(db, user, payload.plan, payload.provider, payload.success_url, payload.cancel_url)
    except NotImplementedError:
        raise api_error(
            400,
            code="UNSUPPORTED_BILLING_PROVIDER",
            message="当前支付渠道暂未开放。",
            current_plan=user.plan,
            suggested_plan=payload.plan,
        )


@router.post('/billing/portal', response_model=BillingPortalResponse)
def create_billing_portal(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = normalize_user_plan(db, current_user)
    try:
        provider, url = portal_url_for_user(user)
    except NotImplementedError:
        raise api_error(400, code="UNSUPPORTED_BILLING_PROVIDER", message="当前支付渠道暂未开放。")
    return BillingPortalResponse(ok=True, url=url, provider=provider)


@router.post('/billing/orders/{order_id}/mock/complete')
def complete_mock_order(order_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = normalize_user_plan(db, current_user)
    order = (
        db.query(BillingOrder)
        .filter(BillingOrder.id == order_id, BillingOrder.user_id == user.id)
        .one_or_none()
    )
    if order is None:
        raise api_error(404, code="ORDER_NOT_FOUND", message="订单不存在。")
    if order.provider != BillingProvider.MOCK:
        raise api_error(400, code="UNSUPPORTED_ORDER_PROVIDER", message="仅支持 mock 订单。")
    if order.status == BillingOrderStatus.PAID:
        return order
    if order.status in {BillingOrderStatus.CANCELLED, BillingOrderStatus.REFUNDED}:
        raise api_error(409, code="ORDER_STATE_INVALID", message="当前订单状态不允许完成支付。")
    return mark_order_paid(db, user, order)


@router.post('/billing/orders/{order_id}/mock/fail')
def fail_mock_order(order_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _user = normalize_user_plan(db, current_user)
    order = (
        db.query(BillingOrder)
        .filter(BillingOrder.id == order_id, BillingOrder.user_id == current_user.id)
        .one_or_none()
    )
    if order is None:
        raise api_error(404, code="ORDER_NOT_FOUND", message="订单不存在。")
    if order.provider != BillingProvider.MOCK:
        raise api_error(400, code="UNSUPPORTED_ORDER_PROVIDER", message="仅支持 mock 订单。")
    if order.status == BillingOrderStatus.PAID:
        raise api_error(409, code="ORDER_STATE_INVALID", message="已支付订单不能标记为失败。")
    if order.status == BillingOrderStatus.CANCELLED:
        raise api_error(409, code="ORDER_STATE_INVALID", message="已取消订单不能标记为失败。")
    return mark_order_failed(db, order)


@router.post('/billing/orders/{order_id}/mock/cancel')
def cancel_mock_order(order_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _user = normalize_user_plan(db, current_user)
    order = (
        db.query(BillingOrder)
        .filter(BillingOrder.id == order_id, BillingOrder.user_id == current_user.id)
        .one_or_none()
    )
    if order is None:
        raise api_error(404, code="ORDER_NOT_FOUND", message="订单不存在。")
    if order.provider != BillingProvider.MOCK:
        raise api_error(400, code="UNSUPPORTED_ORDER_PROVIDER", message="仅支持 mock 订单。")
    if order.status == BillingOrderStatus.PAID:
        raise api_error(409, code="ORDER_STATE_INVALID", message="已支付订单不能取消。")
    if order.status == BillingOrderStatus.CANCELLED:
        return order
    return mark_order_cancelled(db, order)


@router.get('/me/sandbox', response_model=SandboxResponse)
def get_my_sandbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sandbox = SandboxService(db).ensure_for_user(current_user)
    return sandbox


@router.post('/me/sandbox/start', response_model=SandboxResponse)
def start_sandbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    svc = SandboxService(db)
    sandbox = svc.ensure_for_user(current_user)
    result = DockerSandboxManager().ensure_running(str(current_user.id))
    sandbox = svc.mark_running(sandbox, result.container_id)
    return sandbox


@router.post('/me/sandbox/pause', response_model=SandboxResponse)
def pause_sandbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    svc = SandboxService(db)
    sandbox = svc.ensure_for_user(current_user)
    DockerSandboxManager().pause(str(current_user.id))
    return svc.mark_paused(sandbox)


@router.post('/me/sandbox/stop', response_model=SandboxResponse)
def stop_sandbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    svc = SandboxService(db)
    sandbox = svc.ensure_for_user(current_user)
    DockerSandboxManager().stop(str(current_user.id))
    return svc.mark_stopped(sandbox)


@router.get('/tasks/{task_id}', response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail='任务不存在')
    return task


@router.get('/me/tasks', response_model=TaskListResponse)
def list_my_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.started_at.desc())
        .limit(limit)
        .all()
    )
    return TaskListResponse(items=items)


@router.post('/me/tasks')
def create_task(payload: TaskCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_task_for_user(db, current_user, payload)


@router.get('/me/workspace', response_model=WorkspaceListResponse)
def list_workspace(
    path: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_path, entries = WorkspaceService(str(current_user.id)).list_entries(path)
    SandboxService(db).refresh_workspace_size(str(current_user.id))
    return WorkspaceListResponse(base_path=base_path, entries=[WorkspaceEntry(**entry) for entry in entries])


@router.post('/me/workspace/upload', response_model=WorkspaceEntry)
async def upload_workspace_file(
    file: UploadFile = File(...),
    dir_path: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = await WorkspaceService(str(current_user.id)).save_upload(file, dir_path)
    SandboxService(db).refresh_workspace_size(str(current_user.id))
    return WorkspaceEntry(**entry)


@router.get('/me/workspace/download')
def download_workspace_file(
    path: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    target = WorkspaceService(str(current_user.id)).read_file(path)
    media_type = guess_type(target.name)[0] or 'application/octet-stream'
    return FileResponse(target, media_type=media_type, filename=target.name)


@router.get('/users/{email}', response_model=UserResponse, deprecated=True)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    return normalize_user_plan(db, user)


@router.websocket('/ws')
async def websocket_events(websocket: WebSocket):
    token = websocket.query_params.get('token')
    if not token:
        await websocket.close(code=4401, reason='missing token')
        return

    try:
        decoded = decode_access_token(token)
    except Exception:
        await websocket.close(code=4401, reason='invalid token')
        return

    user_id = decoded.get('sub')
    if not user_id:
        await websocket.close(code=4401, reason='invalid token')
        return
    try:
        user_uuid = UUID(str(user_id))
    except ValueError:
        await websocket.close(code=4401, reason='invalid token')
        return

    redis_conn = AsyncRedis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis_conn.pubsub()
    await pubsub.subscribe(user_events_channel(user_id))

    await websocket.accept()
    await websocket.send_json({'type': 'connected'})

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get('data'):
                await websocket.send_text(message['data'])
            try:
                incoming = await asyncio.wait_for(websocket.receive_text(), timeout=0.2)
                if incoming == 'ping':
                    await websocket.send_json({'type': 'pong'})
                else:
                    try:
                        data = json.loads(incoming)
                    except json.JSONDecodeError:
                        continue
                    if data.get('action') == 'create_task':
                        task_payload = TaskCreateRequest(
                            message=data.get('message', ''),
                            command=data.get('command'),
                            timeout_sec=data.get('timeout_sec'),
                        )
                        db = SessionLocal()
                        try:
                            user = db.query(User).filter(User.id == user_uuid).one()
                            create_task_for_user(db, user, task_payload)
                        except HTTPException as exc:
                            await websocket.send_json({'type': 'task_error', 'detail': exc.detail, 'status_code': exc.status_code})
                        finally:
                            db.close()
            except asyncio.TimeoutError:
                continue
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(user_events_channel(user_id))
        await pubsub.close()
        await redis_conn.close()
