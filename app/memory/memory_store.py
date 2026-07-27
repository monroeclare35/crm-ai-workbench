"""
CRM AI 工作台 — Memory 记忆存储

三层记忆体系：
  Layer 1: Session Memory — Agent SDK 原生会话管理（resume session_id）
  Layer 2: User Memory — 用户偏好、习惯、反馈（向量DB + 结构化存储）
  Layer 3: Organizational Memory — 团队最佳实践、成功案例模式（RAG）

当前实现：基于内存的 Mock 存储 + JSON 关键词匹配（生产环境替换为 Milvus）
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Literal


class MemoryStore:
    """
    记忆存储引擎。

    生产环境对接 Milvus（向量检索）+ Redis（热数据缓存）+ MySQL（结构化索引）。
    开发环境使用内存存储 + 简单关键词匹配。
    """

    def __init__(self):
        self._store: dict[str, dict] = {}

    async def add(
        self,
        content: str,
        category: Literal["user_preference", "user_feedback", "lesson_learned", "fact"],
        tags: list[str],
        user_id: str,
    ) -> str:
        """存入一条记忆，返回记忆 ID"""
        memory_id = f"mem_{uuid.uuid4().hex[:12]}"
        entry = {
            "id": memory_id,
            "content": content,
            "category": category,
            "tags": tags,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
        }
        self._store[memory_id] = entry
        return memory_id

    async def search(
        self,
        query: str,
        category: str | None = None,
        user_id: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """
        语义搜索记忆。

        开发环境：关键词匹配打分。
        生产环境：Milvus 向量检索 + Elasticsearch 全文搜索。
        """
        scored: list[tuple[float, dict]] = []

        query_lower = query.lower()
        query_words = re.findall(r"[\w一-鿿]+", query_lower)

        for entry in self._store.values():
            # 分类过滤
            if category and entry["category"] != category:
                continue
            # 用户过滤
            if user_id and entry["user_id"] != user_id:
                continue

            # 关键词打分
            score = 0.0
            content_lower = entry["content"].lower()
            tags_str = " ".join(entry["tags"]).lower()

            for word in query_words:
                if word in content_lower:
                    score += 1.0
                if word in tags_str:
                    score += 2.0
                # 精确短语匹配
                if query_lower in content_lower:
                    score += 3.0

            if score > 0:
                # 时效性衰减：越新的记忆分数越高
                try:
                    ts = datetime.fromisoformat(entry["timestamp"])
                    hours_ago = (datetime.now() - ts).total_seconds() / 3600
                    recency = max(0.7, 1.0 - hours_ago / (24 * 30))  # 30天衰减到0.7
                    score *= recency
                except (ValueError, TypeError):
                    pass

                scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, entry in scored[:top_k]:
            results.append({
                **entry,
                "score": round(score, 2),
            })

        return results

    async def delete(self, memory_id: str) -> bool:
        """删除一条记忆"""
        if memory_id in self._store:
            del self._store[memory_id]
            return True
        return False

    async def list_by_user(
        self,
        user_id: str,
        category: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """列出某用户的所有记忆"""
        results = []
        for entry in self._store.values():
            if entry["user_id"] != user_id:
                continue
            if category and entry["category"] != category:
                continue
            results.append(entry)
        results.sort(key=lambda x: x["timestamp"], reverse=True)
        return results[:limit]


# ============================================================
# 全局单例
# ============================================================

memory_store = MemoryStore()
