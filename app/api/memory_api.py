"""
Memory API — 记忆管理接口

POST /memory/remember  — 存入记忆
POST /memory/recall    — 检索记忆
GET  /memory/list      — 列出记忆
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.memory.memory_store import memory_store
from app.auth.auth import get_current_user
from app.models.schemas import User, MemoryRecallRequest

router = APIRouter(tags=["memory"])


@router.post("/memory/remember")
async def remember(
    content: str,
    category: str = "fact",
    tags: list[str] | None = None,
    user: User = Depends(get_current_user),
):
    """存入一条记忆"""
    memory_id = await memory_store.add(
        content=content,
        category=category,
        tags=tags or [],
        user_id=user.id,
    )
    return {"status": "success", "memory_id": memory_id}


@router.post("/memory/recall")
async def recall(
    request: MemoryRecallRequest,
    user: User = Depends(get_current_user),
):
    """检索相关记忆"""
    results = await memory_store.search(
        query=request.query,
        category=request.category,
        user_id=user.id,
        top_k=request.top_k,
    )
    return {"status": "success", "count": len(results), "memories": results}


@router.get("/memory/list")
async def list_memories(
    category: str | None = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
):
    """列出当前用户的所有记忆"""
    results = await memory_store.list_by_user(
        user_id=user.id,
        category=category,
        limit=limit,
    )
    return {"status": "success", "count": len(results), "memories": results}
