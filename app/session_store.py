"""
Session 持久化存储 — Redis 后端

解决多 worker 部署时 session_id 共享问题。
单进程开发环境降级为内存存储。
"""

from __future__ import annotations

import os
import json
from typing import Any


class SessionStore:
    """
    Session 存储抽象层。

    生产环境：Redis（多 worker 共享）
    开发环境：内存字典（单进程）
    """

    def __init__(self):
        self._is_prod = os.environ.get("APP_ENV", "development") == "production"
        self._memory: dict[str, dict] = {}
        self._redis = None
        self._prefix = "crm_agent_session:"
        self._ttl = 3600 * 24  # 24 小时过期

    async def _get_redis(self):
        """延迟初始化 Redis 连接"""
        if self._redis is not None:
            return self._redis
        if self._is_prod:
            import redis.asyncio as aioredis
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            self._redis = await aioredis.from_url(redis_url)
        return self._redis

    async def save(self, user_id: str, session_id: str, metadata: dict[str, Any] | None = None):
        """保存 session 映射"""
        data = {"session_id": session_id, "metadata": metadata or {}, "user_id": user_id}

        redis = await self._get_redis()
        if redis:
            key = f"{self._prefix}{user_id}"
            await redis.set(key, json.dumps(data, ensure_ascii=False), ex=self._ttl)
        else:
            self._memory[user_id] = data

    async def load(self, user_id: str) -> dict | None:
        """加载 session 映射"""
        redis = await self._get_redis()
        if redis:
            key = f"{self._prefix}{user_id}"
            raw = await redis.get(key)
            if raw:
                return json.loads(raw)
            return None
        else:
            return self._memory.get(user_id)

    async def delete(self, user_id: str):
        """删除 session 映射"""
        redis = await self._get_redis()
        if redis:
            key = f"{self._prefix}{user_id}"
            await redis.delete(key)
        else:
            self._memory.pop(user_id, None)

    async def touch(self, user_id: str):
        """刷新 TTL（用户活跃时延长过期时间）"""
        redis = await self._get_redis()
        if redis:
            key = f"{self._prefix}{user_id}"
            await redis.expire(key, self._ttl)


# 全局单例
session_store = SessionStore()
