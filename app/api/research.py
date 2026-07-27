"""
Deep Research API — 深度调研接口

POST /deep-research          — 启动深度调研
GET  /research/{id}/status   — 查询调研进度
GET  /research/{id}/report   — 获取调研报告
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agent_service import agent_service
from app.auth.auth import get_current_user
from app.models.schemas import User, DeepResearchRequest, DeepResearchStatus

router = APIRouter(tags=["deep-research"])

# 内存状态存储（生产环境用 Redis）
_research_status: dict[str, DeepResearchStatus] = {}


@router.post("/deep-research")
async def start_deep_research(
    request: DeepResearchRequest,
    user: User = Depends(get_current_user),
):
    """
    启动深度调研——唯一使用多 Agent 的场景。

    调研过程：
      1. 任务分解（拆分为3-5个独立子方向）
      2. 并行调研（多 Agent 分头检索）
      3. 交叉验证（对比不同来源）
      4. 报告合成（生成结构化 Markdown 报告）

    返回 research_id，通过 GET /research/{id}/status 查询进度。
    """
    research_id = await agent_service.start_deep_research(user, request.topic)

    status = DeepResearchStatus(
        research_id=research_id,
        status="in_progress",
        progress=0,
    )
    _research_status[research_id] = status

    return {
        "status": "started",
        "research_id": research_id,
        "message": f"深度调研已启动，主题：{request.topic}。预计需要2-5分钟完成。",
    }


@router.get("/research/{research_id}/status")
async def get_research_status(
    research_id: str,
    user: User = Depends(get_current_user),
):
    """查询深度调研的进度"""
    status = _research_status.get(research_id)
    if not status:
        raise HTTPException(status_code=404, detail="调研任务不存在")

    return status.model_dump()


@router.get("/research/{research_id}/report")
async def get_research_report(
    research_id: str,
    user: User = Depends(get_current_user),
):
    """获取深度调研的最终报告"""
    status = _research_status.get(research_id)
    if not status:
        raise HTTPException(status_code=404, detail="调研任务不存在")

    if status.status != "done":
        return {
            "status": status.status,
            "progress": status.progress,
            "message": "报告尚未完成，请稍后再试",
        }

    # 实际场景中从文件系统读取报告
    return {
        "status": "done",
        "research_id": research_id,
        "report_url": f"/app/reports/{research_id}/report.md",
        "message": "报告已生成",
    }
