"""
Chat API — 对话接口

POST /chat/stream — SSE 流式对话（前端 EventSource）
POST /chat/sync  — 同步对话（API/自动化场景）
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.agent_service import agent_service
from app.auth.auth import get_current_user
from app.models.schemas import User, ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    SSE 流式对话接口。

    前端使用 EventSource 或 fetch + ReadableStream 接收流式响应。

    事件类型:
      - text_delta: 文本增量 (content: 新增文本片段)
      - tool_call: 工具调用 (tool_name, tool_input)
      - done: 完成 (content: 最终结果, usage: token用量)
      - error: 错误 (content: 错误信息)
    """
    async def event_generator():
        async for event in agent_service.chat(
            user=user,
            message=request.message,
            task_type=request.task_type,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/sync")
async def chat_sync(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    同步对话接口（非流式）。

    适用于自动化场景、API 调用、批量处理。
    等待 Agent 完成全部推理后返回完整结果。
    """
    events = []
    async for event in agent_service.chat(
        user=user,
        message=request.message,
        task_type=request.task_type,
    ):
        events.append(event)

    # 提取最终结果
    done_events = [e for e in events if e["type"] == "done"]
    error_events = [e for e in events if e["type"] == "error"]

    if done_events:
        done = done_events[-1]  # 取最后一个 done 事件
        return {
            "status": "success",
            "content": done.get("content", ""),
            "usage": done.get("usage", {}),
            "tool_calls": [e for e in events if e["type"] == "tool_call"],
        }
    elif error_events:
        return {
            "status": "error",
            "content": error_events[-1].get("content", "未知错误"),
        }

    return {"status": "error", "content": "未获取到结果"}
