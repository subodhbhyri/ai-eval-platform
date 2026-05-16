import json
import logging
import redis.asyncio as aioredis
from typing import Any, Optional
from app.core.config import get_settings

settings = get_settings()
_redis: Optional[aioredis.Redis] = None
logger = logging.getLogger(__name__)


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_set(key: str, value: Any, ttl: int = None) -> None:
    try:
        r = await get_redis()
        ttl = ttl or settings.cache_ttl_seconds
        if ttl == 0:
            return
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache set failed for {key}: {e}")


async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        data = await r.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        logger.warning(f"Cache get failed for {key}: {e}")
        return None


async def cache_delete(key: str) -> None:
    try:
        r = await get_redis()
        await r.delete(key)
    except Exception as e:
        logger.warning(f"Cache delete failed for {key}: {e}")


async def close_redis():
    global _redis
    if _redis:
        try:
            await _redis.close()
        except Exception:
            pass
        _redis = None
