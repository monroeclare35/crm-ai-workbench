"""
Workflow MCP Server — 任务/工作流管理

提供 CRM 系统中的任务创建、查询、更新能力。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


# Mock 任务存储
_mock_tasks: dict[str, dict] = {}


@tool(
    "create_task",
    "在 CRM 系统中创建任务/待办。用于为自己或他人创建跟进提醒、客户拜访、合同续签等任务。"
    "⚠️ 有副作用，会实际创建任务并通知负责人。",
    {
        "title": str,         # 任务标题
        "description": str,   # 任务描述
        "assignee": str,      # 负责人ID
        "customer_id": str,   # 关联客户ID，可选
        "due_date": str,      # 截止日期 YYYY-MM-DD，可选
        "priority": str,      # 优先级：high/medium/low
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def create_task(args: dict[str, Any]) -> dict[str, Any]:
    """创建任务"""
    task_id = f"TASK-{uuid.uuid4().hex[:8].upper()}"

    task = {
        "id": task_id,
        "title": args["title"],
        "description": args.get("description", ""),
        "assignee": args["assignee"],
        "customer_id": args.get("customer_id"),
        "due_date": args.get("due_date", (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")),
        "priority": args.get("priority", "medium"),
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    _mock_tasks[task_id] = task

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({"success": True, "task": task}, ensure_ascii=False, indent=2),
        }]
    }


@tool(
    "list_tasks",
    "查询任务列表。可按负责人、关联客户、状态、优先级筛选。",
    {
        "assignee": str,      # 负责人ID，可选
        "customer_id": str,   # 关联客户ID，可选
        "status": str,        # 状态：pending/in_progress/done，可选
        "priority": str,      # 优先级：high/medium/low，可选
        "limit": int,         # 返回条数，默认20
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def list_tasks(args: dict[str, Any]) -> dict[str, Any]:
    """查询任务列表"""
    assignee = args.get("assignee")
    status = args.get("status")
    priority = args.get("priority")
    limit = min(args.get("limit", 20), 50)

    results = list(_mock_tasks.values())
    if assignee:
        results = [t for t in results if t["assignee"] == assignee]
    if status:
        results = [t for t in results if t["status"] == status]
    if priority:
        results = [t for t in results if t["priority"] == priority]

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({"count": len(results[:limit]), "tasks": results[:limit]},
                               ensure_ascii=False, indent=2),
        }]
    }


def create_workflow_mcp_server():
    """创建工作流 MCP Server"""
    return create_sdk_mcp_server(
        name="workflow",
        version="1.0.0",
        tools=[create_task, list_tasks],
    )
