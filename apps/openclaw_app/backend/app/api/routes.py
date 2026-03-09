from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from redis import Redis
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, get_db
from app.models.enums import Plan, SandboxStatus, TaskStatus
from app.models.user import User
from app.models.sandbox import Sandbox
from app.models.task import Task
from app.models.daily_usage import DailyUsage
from app.schemas.task import TaskResponse
from app.schemas.user import RegisterRequest, SandboxResponse, UserResponse
from app.services.docker_sandbox import DockerSandboxManager
from app.services.quota import QuotaExceededError, QuotaService
from app.services.sandbox import SandboxService
from app.services.task_queue import TaskQueueService

router = APIRouter()


class TaskCreateRequest(BaseModel):
    message: str
    command: str | list[str] | None = None
    timeout_sec: int | None = None


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


@router.post('/users/{email}/sandbox/start', response_model=SandboxResponse)
def start_sandbox(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')

    svc = SandboxService(db)
    sandbox = svc.ensure_for_user(user)
    result = DockerSandboxManager().ensure_running(str(user.id))
    sandbox = svc.mark_running(sandbox, result.container_id)
    return sandbox


@router.post('/users/{email}/sandbox/pause', response_model=SandboxResponse)
def pause_sandbox(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    sandbox = SandboxService(db).ensure_for_user(user)
    DockerSandboxManager().pause(str(user.id))
    sandbox.status = SandboxStatus.PAUSED
    db.add(sandbox)
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.post('/users/{email}/sandbox/stop', response_model=SandboxResponse)
def stop_sandbox(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    sandbox = SandboxService(db).ensure_for_user(user)
    DockerSandboxManager().stop(str(user.id))
    sandbox.status = SandboxStatus.STOPPED
    db.add(sandbox)
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.get('/tasks/{task_id}', response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail='任务不存在')
    return task


@router.post('/users/{email}/tasks')
def create_task(email: str, payload: TaskCreateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')

    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        QuotaService(redis_client).check_and_consume(str(user.id), user.plan)
    except QuotaExceededError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    sandbox_service = SandboxService(db)
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

    queue_name = TaskQueueService(redis_client).enqueue(
        {
            'task_id': str(task.id),
            'user_id': str(user.id),
            'sandbox_id': str(sandbox.id),
            'container_id': sandbox.container_id,
            'message': payload.message,
            'command': payload.command,
            'timeout_sec': payload.timeout_sec,
        },
        user.plan,
    )

    return {
        'ok': True,
        'task_id': str(task.id),
        'queue': queue_name,
        'sandbox_status': sandbox.status,
        'container_id': sandbox.container_id,
    }
