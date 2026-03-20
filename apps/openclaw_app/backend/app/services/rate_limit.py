from __future__ import annotations

from fastapi import Request
from redis import Redis

from app.services.errors import api_error


class RateLimitService:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    def _key(self, scope: str, identifier: str) -> str:
        return f"rate-limit:{scope}:{identifier}"

    def check(self, scope: str, identifier: str, *, limit: int, window_sec: int) -> None:
        key = self._key(scope, identifier)
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_sec, nx=True)
        count, _ = pipe.execute()
        if int(count) > limit:
            raise api_error(
                429,
                code="RATE_LIMITED",
                message="请求过于频繁，请稍后再试。",
            )


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
