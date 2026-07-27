"""
MCP Server 单元测试
"""

import pytest
from app.mcp_servers.crm_data_mcp import search_customers, get_customer_detail, query_consumption
from app.mcp_servers.ad_knowledge_mcp import search_ad_knowledge, get_knowledge_detail


@pytest.mark.asyncio
async def test_search_customers_all():
    """搜索全部客户"""
    result = await search_customers({"limit": 10})
    data = result["content"][0]["text"]
    assert "C001" in data
    assert "count" in data


@pytest.mark.asyncio
async def test_search_customers_by_industry():
    """按行业搜索"""
    result = await search_customers({"industry": "电商", "limit": 10})
    data = result["content"][0]["text"]
    assert "美妆" in data
    assert "鹏程" in data


@pytest.mark.asyncio
async def test_search_customers_not_found():
    """搜索不存在的行业"""
    result = await search_customers({"industry": "航天", "limit": 10})
    data = result["content"][0]["text"]
    assert "count" in data


@pytest.mark.asyncio
async def test_get_customer_detail():
    """获取客户详情"""
    result = await get_customer_detail({"customer_id": "C001"})
    data = result["content"][0]["text"]
    assert "上海美妆" in data
    assert "recent_consumption" in data


@pytest.mark.asyncio
async def test_get_customer_detail_not_found():
    """客户不存在"""
    result = await get_customer_detail({"customer_id": "C999"})
    assert result.get("is_error") is True


@pytest.mark.asyncio
async def test_query_consumption():
    """查询消耗数据"""
    result = await query_consumption({
        "customer_ids": ["C001"],
        "start_date": "2026-07-01",
        "end_date": "2026-07-27",
        "group_by": "day",
    })
    data = result["content"][0]["text"]
    assert "data" in data


@pytest.mark.asyncio
async def test_query_consumption_mom():
    """环比查询"""
    result = await query_consumption({
        "customer_ids": ["C001"],
        "start_date": "2026-07-01",
        "end_date": "2026-07-27",
        "group_by": "customer",
        "compare": "mom",
    })
    data = result["content"][0]["text"]
    assert "cost_change_pct" in data


@pytest.mark.asyncio
async def test_search_ad_knowledge():
    """搜索广告知识"""
    result = await search_ad_knowledge({"query": "oCPM 出价策略", "top_k": 3})
    data = result["content"][0]["text"]
    assert "oCPM" in data


@pytest.mark.asyncio
async def test_get_knowledge_detail():
    """获取知识详情"""
    result = await get_knowledge_detail({"doc_id": "K001"})
    data = result["content"][0]["text"]
    assert "oCPM" in data
    assert "转化成本" in data
