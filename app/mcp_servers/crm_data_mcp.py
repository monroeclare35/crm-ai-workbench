"""
CRM Data MCP Server — 客户数据查询

提供 CRM 系统中的客户搜索、360°画像、消耗数据查询能力。
所有工具均为只读操作（readOnlyHint=True），Agent 可并行调用。

工具列表:
  - search_customers: 多条件搜索客户
  - get_customer_detail: 获取客户360°画像
  - query_consumption: 查询消耗数据（多维聚合 + 同环比）
"""

from __future__ import annotations

import json
import random
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


# ============================================================
# Mock 数据（开发环境）
# ============================================================

MOCK_CUSTOMERS: list[dict[str, Any]] = [
    {
        "id": "C001", "name": "上海美妆科技有限公司", "industry": "电商", "sub_industry": "美妆个护",
        "region": "华东区", "scale": "500-1000人", "level": "S", "owner": "dev-sales-001",
        "owner_name": "张三", "first_coop_date": "2024-03-15", "contract_status": "正常",
        "contract_end_date": "2027-03-14", "main_products": ["巨量千川", "巨量引擎"],
        "active_accounts": 8, "cost_30d": 2850000.00, "cost_trend": "rising",
        "total_arrears": 0.0, "payment_rating": "A", "service_rating": 4.8,
        "recent_tickets": 1, "health_status": "healthy", "health_score": 92,
        "churn_signals": [],
    },
    {
        "id": "C002", "name": "杭州鲸灵网络有限公司", "industry": "游戏", "sub_industry": "手游",
        "region": "华东区", "scale": "200-500人", "level": "A", "owner": "dev-sales-001",
        "owner_name": "张三", "first_coop_date": "2024-06-01", "contract_status": "正常",
        "contract_end_date": "2025-12-31", "main_products": ["巨量引擎", "穿山甲"],
        "active_accounts": 5, "cost_30d": 1520000.00, "cost_trend": "declining",
        "total_arrears": 0.0, "payment_rating": "B", "service_rating": 4.2,
        "recent_tickets": 4, "health_status": "warning", "health_score": 65,
        "churn_signals": ["消耗连续2月下降超30%", "合同即将到期"],
    },
    {
        "id": "C003", "name": "南京星辉教育科技有限公司", "industry": "教育", "sub_industry": "职业技能",
        "region": "华东区", "scale": "100-200人", "level": "B", "owner": "dev-sales-001",
        "owner_name": "张三", "first_coop_date": "2025-01-10", "contract_status": "正常",
        "contract_end_date": "2026-01-09", "main_products": ["巨量千川"],
        "active_accounts": 3, "cost_30d": 680000.00, "cost_trend": "stable",
        "total_arrears": 50000.00, "payment_rating": "C", "service_rating": 3.8,
        "recent_tickets": 2, "health_status": "warning", "health_score": 55,
        "churn_signals": ["回款不及时", "服务满意度下降"],
    },
    {
        "id": "C004", "name": "北京未来科技有限公司", "industry": "AI/科技", "sub_industry": "大模型",
        "region": "华北区", "scale": "500-1000人", "level": "S", "owner": "dev-sales-001",
        "owner_name": "张三", "first_coop_date": "2023-09-01", "contract_status": "正常",
        "contract_end_date": "2026-09-01", "main_products": ["巨量引擎", "巨量搜索"],
        "active_accounts": 12, "cost_30d": 5200000.00, "cost_trend": "rising",
        "total_arrears": 0.0, "payment_rating": "A", "service_rating": 4.9,
        "recent_tickets": 0, "health_status": "healthy", "health_score": 98,
        "churn_signals": [],
    },
    {
        "id": "C005", "name": "深圳鹏程电商有限公司", "industry": "电商", "sub_industry": "综合电商",
        "region": "华南区", "scale": ">1000人", "level": "A", "owner": "dev-sales-001",
        "owner_name": "张三", "first_coop_date": "2024-01-15", "contract_status": "正常",
        "contract_end_date": "2026-06-30", "main_products": ["巨量千川", "巨量引擎", "穿山甲"],
        "active_accounts": 20, "cost_30d": 8900000.00, "cost_trend": "stable",
        "total_arrears": 0.0, "payment_rating": "A", "service_rating": 4.5,
        "recent_tickets": 3, "health_status": "healthy", "health_score": 85,
        "churn_signals": [],
    },
]

# 为每个客户生成 mock 消耗数据
MOCK_CONSUMPTION: dict[str, list[dict]] = {}
for c in MOCK_CUSTOMERS:
    records = []
    base = c["cost_30d"] / 30
    for day in range(1, 28):
        noise = random.uniform(-0.12, 0.12)
        cost = round(base * (1 + noise), 2)
        records.append({
            "date": f"2026-07-{day:02d}", "cost": cost,
            "impression": int(cost * 50), "click": int(cost * 1.2),
            "ctr": round(random.uniform(1.8, 3.2), 2),
            "cvr": round(random.uniform(1.0, 2.5), 2),
            "roi": round(random.uniform(1.2, 3.5), 2),
        })
    MOCK_CONSUMPTION[c["id"]] = records


# ============================================================
# Tool 实现
# ============================================================

@tool(
    "search_customers",
    "搜索客户。当你需要查找/列出/筛选客户时使用此工具（而非获取单个客户详情）。"
    "支持按名称关键词、行业、区域、客户等级(S/A/B/C)、销售负责人等条件组合筛选。"
    "返回客户简要列表（ID、名称、行业、区域、等级、负责人、近30天消耗、健康状态）。"
    "如果不指定任何筛选条件，返回全部客户。"
    "注意：此工具返回简要信息。如需查看某个客户的合同、投放详情、服务记录等完整信息，请用 get_customer_detail。",
    {
        "keyword": str,       # 搜索关键词（匹配客户名称、行业、子行业）
        "industry": str,      # 行业筛选（电商/游戏/教育/AI/科技），可选
        "region": str,        # 区域筛选（华东区/华北区/华南区），可选
        "level": str,         # 客户等级（S/A/B/C），可选
        "owner": str,         # 销售负责人ID，可选
        "limit": int,         # 返回数量限制，默认20，最大100
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def search_customers(args: dict[str, Any]) -> dict[str, Any]:
    """搜索客户——多条件筛选"""
    keyword = (args.get("keyword") or "").lower()
    industry = (args.get("industry") or "").lower()
    region = (args.get("region") or "").lower()
    level = (args.get("level") or "").upper()
    owner = args.get("owner")
    limit = min(args.get("limit", 20), 100)

    results = []
    for c in MOCK_CUSTOMERS:
        if keyword:
            if not (keyword in c["name"].lower()
                    or keyword in c["industry"].lower()
                    or keyword in c.get("sub_industry", "").lower()):
                continue
        if industry and c["industry"].lower() != industry:
            continue
        if region and c["region"].lower() != region:
            continue
        if level and c["level"] != level:
            continue
        if owner and c["owner"] != owner:
            continue
        if len(results) >= limit:
            break
        results.append({
            "id": c["id"], "name": c["name"], "industry": c["industry"],
            "region": c["region"], "level": c["level"], "owner": c["owner"],
            "owner_name": c["owner_name"], "cost_30d": c["cost_30d"],
            "health_status": c["health_status"],
        })

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({"count": len(results), "customers": results},
                               ensure_ascii=False, indent=2),
        }]
    }


@tool(
    "get_customer_detail",
    "获取单个客户的360°全貌信息。当你需要深入了解某个具体客户时使用此工具"
    "（而非批量搜索/列出客户——那种场景请用 search_customers）。"
    "返回内容包括：基本信息、行业与规模、合同状况、投放产品与账户、"
    "近30天消耗及趋势、回款评级、服务满意度、健康度评分、流失风险信号、近期消耗明细。"
    "注意：如果你只需要客户的名称/行业/等级等基本字段，用 search_customers 更高效。"
    "此工具返回完整信息，适合拜访准备、客户诊断等深度场景。",
    {
        "customer_id": str,   # 客户ID，必填。可从 search_customers 获取
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def get_customer_detail(args: dict[str, Any]) -> dict[str, Any]:
    """获取客户360°画像"""
    customer_id = args["customer_id"]
    for c in MOCK_CUSTOMERS:
        if c["id"] == customer_id:
            detail = {**c, "recent_consumption": MOCK_CONSUMPTION.get(customer_id, [])[-7:]}
            return {
                "content": [{"type": "text", "text": json.dumps(detail, ensure_ascii=False, indent=2)}]
            }
    return {
        "content": [{"type": "text", "text": f"未找到客户 {customer_id}"}],
        "is_error": True,
    }


@tool(
    "query_consumption",
    "查询客户的广告消耗数据（聚合级别）。当你需要分析消耗趋势、对比、汇总时使用此工具。"
    "支持按天/周/月/客户/行业/区域/产品线多维度聚合，支持同比(yoy)和环比(mom)对比。"
    "可同时查询多个客户。常用指标：cost(消耗)、impression(曝光)、click(点击)、ctr(点击率)、cvr(转化率)、roi(投资回报率)。"
    "注意：此工具返回的是聚合后的数据。如果你需要逐条原始记录做自定义分析，"
    "用此工具获取数据后通过 Bash + Python 脚本处理，而不是反复调用此工具做多次聚合。"
    "同环比用 compare 参数一步完成，不要分两次查询再自己算。",
    {
        "customer_ids": list[str],  # 客户ID列表，不填则查询全部
        "start_date": str,          # 开始日期，格式 YYYY-MM-DD
        "end_date": str,            # 结束日期，格式 YYYY-MM-DD
        "group_by": str,            # 聚合维度：day/week/month/customer/industry/region
        "metrics": list[str],       # 指标列表：cost/impression/click/ctr/cvr/roi
        "compare": str,             # 对比方式：yoy(同比)/mom(环比)/none
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def query_consumption(args: dict[str, Any]) -> dict[str, Any]:
    """查询消耗数据——多维聚合+同环比"""
    customer_ids = args.get("customer_ids", [])
    start_date = args.get("start_date", "2026-07-01")
    end_date = args.get("end_date", "2026-07-27")
    group_by = args.get("group_by", "day")
    metrics = args.get("metrics", ["cost", "roi"])
    compare = args.get("compare", "none")

    # 收集数据
    all_records = []
    cids = customer_ids if customer_ids else list(MOCK_CONSUMPTION.keys())
    for cid in cids:
        records = MOCK_CONSUMPTION.get(cid, [])
        for r in records:
            all_records.append({"customer_id": cid, **r})

    # 聚合
    if group_by == "day":
        aggregated: dict[str, dict] = {}
        for r in all_records:
            day = r["date"]
            if day not in aggregated:
                aggregated[day] = {"dimensions": {"date": day}, "cost": 0, "roi": 0, "count": 0}
            aggregated[day]["cost"] += r["cost"]
            aggregated[day]["roi"] = max(aggregated[day]["roi"], r["roi"])
            aggregated[day]["count"] += 1
        data = sorted(aggregated.values(), key=lambda x: x["dimensions"]["date"])
    elif group_by == "customer":
        data = []
        for cid in cids:
            records = MOCK_CONSUMPTION.get(cid, [])
            total_cost = sum(r["cost"] for r in records)
            avg_roi = round(sum(r["roi"] for r in records) / len(records), 2) if records else 0
            data.append({"dimensions": {"customer_id": cid}, "cost": total_cost, "roi": avg_roi})
    else:
        # 简化处理：其他聚合维度返回按天数据
        data = [{"dimensions": {"date": r["date"]}, "cost": r["cost"], "roi": r["roi"]}
                for r in all_records]

    # 同环比
    if compare == "mom":
        for item in data:
            item["cost_prev"] = round(item["cost"] * 0.92, 2)
            item["cost_change_pct"] = round((item["cost"] - item["cost_prev"]) / item["cost_prev"] * 100, 1)
    elif compare == "yoy":
        for item in data:
            item["cost_prev"] = round(item["cost"] * 0.78, 2)
            item["cost_change_pct"] = round((item["cost"] - item["cost_prev"]) / item["cost_prev"] * 100, 1)

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "query": {"start_date": start_date, "end_date": end_date, "group_by": group_by, "compare": compare},
                "count": len(data), "data": data,
            }, ensure_ascii=False, indent=2),
        }]
    }


# ============================================================
# 创建 Server
# ============================================================

def create_crm_data_mcp_server():
    """创建 CRM Data MCP Server（SDK 内嵌模式）"""
    return create_sdk_mcp_server(
        name="crm_data",
        version="1.0.0",
        tools=[search_customers, get_customer_detail, query_consumption],
    )
