"""
Messaging MCP Server — 消息推送

支持飞书、企业微信消息发送。有副作用（destructiveHint=True）。
"""

from __future__ import annotations

import json
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


@tool(
    "send_message",
    "向指定用户或群组发送消息。当你需要推送报告、发送告警、通知提醒时使用此工具。"
    "支持飞书(feishu)和企业微信(wecom)两个渠道。"
    "消息类型：text(纯文本)、markdown(Markdown格式，推荐)、card(卡片消息)、file(文件)。"
    "⚠️ 有副作用(destructive)，发送前务必确认接收人和内容。不要主动发送除非用户要求或定时任务触发。"
    "⚠️ 批量发送(>5人)需要审批。不要使用此工具发送全员消息。",
    {
        "channel": str,       # 渠道：feishu / wecom
        "recipient": str,     # 接收人ID（用户ID）或群ID（chat_id）。多个接收人用逗号分隔
        "content": str,       # 消息内容。markdown类型支持 Markdown 语法
        "msg_type": str,      # 消息类型：text / markdown / card / file
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def send_message(args: dict[str, Any]) -> dict[str, Any]:
    """发送消息"""
    channel = args["channel"]
    recipient = args["recipient"]
    content = args["content"]
    msg_type = args.get("msg_type", "markdown")

    # 生产环境：调用飞书/企业微信 API
    # 开发环境：模拟发送
    mock_msg_id = f"msg_{channel}_{hash(recipient + content) % 100000:05d}"

    recipient_display = recipient
    if "," in recipient:
        count = len(recipient.split(","))
        recipient_display = f"{count}位用户"

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "success": True,
                "msg_id": mock_msg_id,
                "channel": channel,
                "recipient": recipient_display,
                "msg_type": msg_type,
                "preview": content[:100] + ("..." if len(content) > 100 else ""),
            }, ensure_ascii=False, indent=2),
        }]
    }


def create_messaging_mcp_server():
    """创建消息推送 MCP Server"""
    return create_sdk_mcp_server(
        name="messaging",
        version="1.0.0",
        tools=[send_message],
    )
