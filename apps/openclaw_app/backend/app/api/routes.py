from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from redis import Redis
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, get_db
from app.models.enums import Plan
from app.models.user import User
from app.models.sandbox import Sandbox
from app.models.task import Task
from app.models.daily_usage import DailyUsage
from app.schemas.user import RegisterRequest, SandboxResponse, UserResponse
from app.services.quota import QuotaExceededError, QuotaService
from app.services.sandbox import SandboxService

router = APIRouter()


@router.get('/healthz')
def healthz():
    return {'ok': True, 'service': settings.app_name}


@router.post('/bootstrap-db')
def bootstrap_db():
    Base.metadata.create_all(bind=engine)
    return {'ok': True}


@router.post('/register', response_model=UserResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail='邮箱已存在')

    user = User(
        email=payload.email,
        password_hash=f'plain:{payload.password}',
        trial_ends_at=datetime.utcnow() + timedelta(days=7),
        last_active_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    SandboxService(db).ensure_for_user(user)
    return user


@router.get('/users/{email}', response_model=UserResponse)
def get_user(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    return user


@router.get('/users/{email}/sandbox', response_model=SandboxResponse)
def get_user_sandbox(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    sandbox = SandboxService(db).ensure_for_user(user)
    return sandbox


@router.post('/users/{email}/consume-free-task')
def consume_free_task(email: str):
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    # 暂时用 email 作为 key，后面接认证后换 user_id
    try:
        QuotaService(redis_client).check_and_consume(email, Plan.FREE)
    except QuotaExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return {'ok': True}
