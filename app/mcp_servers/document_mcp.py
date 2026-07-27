"""
Document MCP Server — 文档操作

提供文档搜索和创建能力。对接内部知识库/文档系统。
"""

from __future__ import annotations

import json
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


@tool(
    "search_documents",
    "搜索文档系统（知识库、SOP、培训材料等）。支持全文搜索和标签过滤。"
    "覆盖：销售SOP、运营手册、产品文档、培训资料、会议纪要等。",
    {
        "query": str,         # 搜索关键词
        "doc_type": str,      # 文档类型：sop/manual/product/training/meeting
        "top_k": int,         # 返回结果数，默认5
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def search_documents(args: dict[str, Any]) -> dict[str, Any]:
    """搜索文档"""
    query = args["query"]
    doc_type = args.get("doc_type")
    top_k = min(args.get("top_k", 5), 10)

    # Mock
    mock_docs = [
        {"id": "DOC001", "title": "华东区销售SOP v3.2", "type": "sop",
         "summary": "客户开发→需求分析→方案制定→商务谈判→签约→交付的标准流程",
         "updated_at": "2026-07-15"},
        {"id": "DOC002", "title": "巨量千川运营手册", "type": "manual",
         "summary": "千川广告账户搭建、素材制作、数据分析和优化策略",
         "updated_at": "2026-07-20"},
    ]

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({"query": query, "count": len(mock_docs), "results": mock_docs},
                               ensure_ascii=False, indent=2),
        }]
    }


@tool(
    "create_document",
    "在文档系统中创建新文档。用于保存分析报告、会议纪要、策略文档等。"
    "⚠️ 有副作用，会实际创建文档。",
    {
        "title": str,         # 文档标题
        "content": str,       # 文档内容（Markdown 格式）
        "doc_type": str,      # 文档类型
        "tags": list[str],    # 标签
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def create_document(args: dict[str, Any]) -> dict[str, Any]:
    """创建文档"""
    mock_id = f"DOC{hash(args['title']) % 10000:04d}"

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({"success": True, "doc_id": mock_id, "title": args["title"],
                                "url": f"https://docs.internal.corp/{mock_id}"},
                               ensure_ascii=False, indent=2),
        }]
    }


def create_document_mcp_server():
    """创建文档操作 MCP Server"""
    return create_sdk_mcp_server(
        name="document",
        version="1.0.0",
        tools=[search_documents, create_document],
    )
