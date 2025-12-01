"""Redis cache service"""
import json
from datetime import timedelta
from functools import wraps
from typing import Any, Callable, Optional

import redis.asyncio as redis
from redis.asyncio import Redis

from .config import settings


class CacheService:
    """Redis cache service for storing temporary data"""
    
    def __init__(self):
        self._redis: Optional[Redis] = None
    
    async def connect(self):
        """Connect to Redis"""
        if not self._redis:
            self._redis = await redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self._redis:
            await self._redis.close()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self._redis:
            await self.connect()
        
        value = await self._redis.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with optional TTL (in seconds)"""
        if not self._redis:
            await self.connect()
        
        if ttl is None:
            ttl = settings.cache_default_ttl
        
        serialized = json.dumps(value) if not isinstance(value, str) else value
        return await self._redis.setex(key, ttl, serialized)
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if not self._redis:
            await self.connect()
        
        return await self._redis.delete(key) > 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self._redis:
            await self.connect()
        
        return await self._redis.exists(key) > 0
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern"""
        if not self._redis:
            await self.connect()
        
        keys = []
        async for key in self._redis.scan_iter(match=pattern):
            keys.append(key)
        
        if keys:
            return await self._redis.delete(*keys)
        return 0


# Global cache instance
cache = CacheService()


def cached(
    key_prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[Callable] = None
):
    """
    Decorator to cache function results in Redis.
    
    Usage:
        @cached(key_prefix="patient", ttl=300)
        async def get_patient(patient_id: int):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = f"{key_prefix}:{key_builder(*args, **kwargs)}"
            else:
                # Default: use first argument as key
                arg_key = args[0] if args else list(kwargs.values())[0]
                cache_key = f"{key_prefix}:{arg_key}"
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            if result is not None:
                await cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


async def get_cache_service() -> CacheService:
    """Dependency injection for cache service"""
    if not cache._redis:
        await cache.connect()
    return cache
