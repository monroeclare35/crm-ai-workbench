"""
CRM AI 工作台 — 安全鉴权 Hook

在 Agent 执行工具调用前进行权限校验。
Hook 在 Claude Agent SDK 的 PreToolUse 事件中触发。
"""

from __future__ import annotations

from typing import Any

from app.auth.auth import permission_service


# ============================================================
# CRM 数据权限 Hook
# ============================================================

async def crm_data_access_control(
    tool_name: str,
    tool_input: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """
    在执行 CRM 数据查询前，校验用户是否有数据权限。

    规则：
    1. 销售只能查询自己负责的客户
    2. 跨区域查询需要 cross_region_access 权限
    3. 管理员和分析师可以查询全部
    """
    user = context.get("user")
    if not user:
        return {"allowed": True}  # 无用户上下文时放行（测试环境）

    user_id = user.id if hasattr(user, "id") else user.get("id", "")

    # 检查客户权限
    customer_ids = tool_input.get("customer_ids", [])
    if customer_ids:
        for cid in customer_ids:
            if not await permission_service.can_access_customer(user_id, cid):
                return {
                    "allowed": False,
                    "reason": f"你没有权限查看客户 {cid} 的数据。该客户不在你的负责范围内。",
                }

    # 如果是单客户查询
    single_cid = tool_input.get("customer_id")
    if single_cid:
        if not await permission_service.can_access_customer(user_id, single_cid):
            return {
                "allowed": False,
                "reason": f"你没有权限查看客户 {single_cid} 的数据。",
            }

    # 跨区域检查
    region = tool_input.get("region")
    if region:
        if not await permission_service.can_access_region(user_id, region):
            return {
                "allowed": False,
                "reason": f"你没有跨区域查询权限。你的区域不包含 {region}。",
            }

    return {"allowed": True}


# ============================================================
# 消息发送审批 Hook
# ============================================================

async def messaging_approval(
    tool_name: str,
    tool_input: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """
    消息发送前的审批检查。

    规则：
    1. 单发消息 → 用户在 Agent 运行时手动确认（permission_mode=default）
    2. 批量发送（多个接收人）→ 需要额外审批
    3. 发送到全员 → 拒绝（需要走审批流）
    """
    recipient = tool_input.get("recipient", "")

    # 全员发送拦截
    if recipient.lower() in ("all", "everyone", "全员"):
        return {
            "allowed": False,
            "reason": "发送全员消息需要走正式审批流程，请通过 OA 提交审批单。",
        }

    # 批量发送告警（>5人）
    if "," in recipient:
        count = len(recipient.split(","))
        if count > 5:
            return {
                "allowed": False,
                "reason": f"批量发送给 {count} 人需要审批。建议分批发送或提交审批单。",
            }

    return {"allowed": True}


# ============================================================
# Bash 命令安全 Hook
# ============================================================

async def bash_safety_check(
    tool_name: str,
    tool_input: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """
    Bash 命令安全检查。

    阻止危险命令：rm -rf、sudo、chmod 777、fork bomb 等。
    """
    command = tool_input.get("command", "")

    dangerous_patterns = [
        "rm -rf /",
        "rm -rf /*",
        "rm -rf ~",
        "sudo ",
        "chmod 777",
        ":(){ :|:& };:",   # fork bomb
        "> /dev/sda",
        "mkfs.",
        "dd if=",
        "curl.*|.*sh",     # piping curl to shell
    ]

    for pattern in dangerous_patterns:
        if pattern in command:
            return {
                "allowed": False,
                "reason": f"检测到危险命令模式: '{pattern}'。此操作已被阻止。",
            }

    return {"allowed": True}
