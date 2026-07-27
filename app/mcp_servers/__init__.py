"""
CRM AI 工作台 — MCP Server 注册中心

统一管理所有 MCP Server 的创建和配置。
每个 Server 返回 create_sdk_mcp_server() 结果，在 AgentService 中注入到 ClaudeAgentOptions。
"""

from app.mcp_servers.crm_data_mcp import create_crm_data_mcp_server
from app.mcp_servers.ad_knowledge_mcp import create_ad_knowledge_mcp_server
from app.mcp_servers.analytics_mcp import create_analytics_mcp_server
from app.mcp_servers.messaging_mcp import create_messaging_mcp_server
from app.mcp_servers.document_mcp import create_document_mcp_server
from app.mcp_servers.workflow_mcp import create_workflow_mcp_server

__all__ = [
    "create_crm_data_mcp_server",
    "create_ad_knowledge_mcp_server",
    "create_analytics_mcp_server",
    "create_messaging_mcp_server",
    "create_document_mcp_server",
    "create_workflow_mcp_server",
]
