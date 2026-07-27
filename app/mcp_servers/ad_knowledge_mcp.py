"""
Ad Knowledge MCP Server — 广告知识库检索 (RAG)

提供广告投放政策、策略最佳实践、行业案例、产品文档的语义搜索。
底层对接 Milvus 向量数据库 + Elasticsearch 混合检索。
"""

from __future__ import annotations

import json
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


# ============================================================
# Mock 知识库
# ============================================================

MOCK_KNOWLEDGE: list[dict[str, Any]] = [
    {
        "id": "K001",
        "title": "巨量千川 oCPM 出价策略详解",
        "content": "oCPM（Optimized Cost Per Mille）是巨量千川的智能出价产品，以转化为优化目标。"
                   "系统根据广告主设定的转化目标（如下单、付费），自动调整出价。"
                   "适用场景：有明确转化目标和充足转化数据的广告主。"
                   "核心优势：转化成本稳定，跑量能力优于手动出价。"
                   "注意事项：需要至少20个/天的转化量级，新建计划有学习期（1-3天）。",
        "category": "product",
        "tags": ["出价策略", "oCPM", "千川", "转化"],
        "source": "巨量千川帮助中心",
    },
    {
        "id": "K002",
        "title": "电商行业巨量千川投放最佳实践",
        "content": "电商投放核心公式：GMV = 曝光 × CTR × CVR × 客单价。"
                   "优化重点：素材CTR > 落地页CVR > 出价策略。"
                   "素材策略：短视频15-30秒最佳，前3秒必须有钩子，真人出镜CTR比图文高30%。"
                   "直播投流：直播间画面+商品卡组合投放，投前30分钟预热。"
                   "ROI优化：先用oCPM跑量积累模型，稳定后切换自动出价控成本。"
                   "数据监控：重点关注GPM（千次展示成交额），而非单纯消耗。",
        "category": "strategy",
        "tags": ["电商", "千川", "投放策略", "ROI", "素材"],
        "source": "商业化运营团队",
    },
    {
        "id": "K003",
        "title": "穿山甲广告联盟变现指南",
        "content": "穿山甲是字节跳动旗下广告联盟，覆盖超10万APP。"
                   "主流广告形式：开屏、激励视频、信息流、插屏、Banner。"
                   "激励视频eCPM最高，适合游戏类APP；信息流适合内容类APP。"
                   "优化要点：填充率、展示率、eCPM三者平衡。"
                   "Waterfall+Bidding混合模式可最大化收益。",
        "category": "product",
        "tags": ["穿山甲", "广告联盟", "变现", "eCPM"],
        "source": "穿山甲官方文档",
    },
    {
        "id": "K004",
        "title": "教育行业广告投放合规要点",
        "content": "2025年教育行业广告监管趋严。核心要求："
                   "1. 学科类培训广告全面禁止投放"
                   "2. 非学科类需提供办学许可证和教师资格证"
                   "3. 广告文案不得包含"保过""包就业"等绝对化用语"
                   "4. 落地页必须标注价格和退费规则"
                   "5. K12受众定向禁止使用年龄/年级标签"
                   "违规处罚：首次警告+素材下架，再犯封停账户7-30天。",
        "category": "policy",
        "tags": ["教育", "合规", "政策", "审核"],
        "source": "广告审核中心",
    },
    {
        "id": "K005",
        "title": "游戏行业买量ROI优化案例——杭州鲸灵网络",
        "content": "杭州鲸灵（手游发行商）通过以下组合拳将ROI从1.2提升至2.5："
                   "1. 素材策略：从单一游戏录屏 → 真人解说+KOL混剪，CTR从1.5%提升至2.8%"
                   "2. 定向优化：放弃通投，基于付费用户画像（25-35岁男性、一线城市）精准定向"
                   "3. 出价策略：从手动出价切换oCPM，激活成本降低40%"
                   "4. 落地页：增加社交 proof（玩家好评截图），CVR从3%提升至5.5%"
                   "关键教训：不要只看消耗，关注LTV/CAC比值。",
        "category": "case",
        "tags": ["游戏", "ROI优化", "案例", "素材", "oCPM"],
        "source": "行业案例库",
    },
    {
        "id": "K006",
        "title": "巨量搜索广告投放指南",
        "content": "巨量搜索是基于抖音搜索流量的广告产品，用户在抖音搜索关键词时展示广告。"
                   "核心优势：用户主动搜索=高意图流量，转化率是信息流的3-5倍。"
                   "投放策略：1) 关键词选择：品牌词+品类词+竞品词+场景词 四维覆盖"
                   "2) 匹配模式：短语匹配为主，精确匹配补充高转化词"
                   "3) 出价：建议oCPC，比信息流CPC高30-50%是正常的（CVR更高）"
                   "4) 落地页：搜索流量对落地页相关性要求高，建议用专用落地页。",
        "category": "product",
        "tags": ["搜索广告", "巨量搜索", "SEM", "关键词"],
        "source": "巨量引擎帮助中心",
    },
    {
        "id": "K007",
        "title": "2026年Q2各行业广告投放Benchmark",
        "content": "行业平均数据（2026Q2，来源：巨量引擎数据中心）："
                   "电商：CTR 2.1%, CVR 1.8%, 平均CPA ¥45, 平均ROI 2.6"
                   "游戏：CTR 2.8%, CVR 1.5%, 平均CPA ¥38, 平均ROI 2.2"
                   "教育：CTR 1.8%, CVR 2.5%, 平均CPA ¥55, 平均ROI 3.1"
                   "金融：CTR 1.5%, CVR 1.2%, 平均CPA ¥120, 平均ROI 1.8"
                   "AI/科技：CTR 2.3%, CVR 2.0%, 平均CPA ¥65, 平均ROI 2.9"
                   "本地生活：CTR 3.2%, CVR 4.5%, 平均CPA ¥18, 平均ROI 5.5",
        "category": "strategy",
        "tags": ["benchmark", "行业数据", "CTR", "ROI"],
        "source": "巨量引擎数据中心",
    },
]


# ============================================================
# Tool 实现
# ============================================================

def _simple_search(query: str, category: str | None, product: str | None, top_k: int) -> list[dict]:
    """简单的关键词+分类过滤搜索（Mock 实现，生产用 Milvus+ES）"""
    query_lower = query.lower()
    scored = []

    for doc in MOCK_KNOWLEDGE:
        # 分类过滤
        if category and doc["category"] != category:
            continue
        if product:
            product_lower = product.lower()
            if not (product_lower in doc["title"].lower() or product_lower in " ".join(doc["tags"]).lower()):
                continue

        # 关键词打分（简化的 TF + 位置加权）
        score = 0.0
        title_lower = doc["title"].lower()
        content_lower = doc["content"].lower()
        tags_str = " ".join(doc["tags"]).lower()

        for word in query_lower.split():
            if word in title_lower:
                score += 3.0
            if word in tags_str:
                score += 2.0
            if word in content_lower:
                score += 1.0

        if score > 0:
            scored.append({"doc": doc, "score": score})

    # 按相关度排序
    scored.sort(key=lambda x: x["score"], reverse=True)

    results = []
    for item in scored[:top_k]:
        doc = item["doc"]
        results.append({
            "id": doc["id"],
            "title": doc["title"],
            "content": doc["content"][:600],
            "category": doc["category"],
            "tags": doc["tags"],
            "source": doc["source"],
            "relevance": round(item["score"], 1),
        })

    return results


@tool(
    "search_ad_knowledge",
    "检索广告投放相关知识（语义搜索）。当你需要查阅广告政策、投放策略、行业案例、"
    "产品文档时使用此工具。覆盖：政策规则(policy)、投放策略(strategy)、行业案例(case)、"
    "产品文档(product)、FAQ(faq)。支持按分类(category)和产品线(product)过滤。"
    "注意：此工具返回摘要。如果摘要信息不够做决策，用 get_knowledge_detail 获取完整文档。"
    "做策略建议时必须先调用此工具获取行业知识，不要仅凭模型自身知识给出建议。"
    {
        "query": str,         # 搜索问题或关键词，建议用自然语言描述
        "category": str,      # 知识分类，可选：policy/strategy/case/product/faq
        "product": str,       # 产品线筛选，可选：千川/引擎/搜索/穿山甲
        "top_k": int,         # 返回最相关结果数，默认5，最大10
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def search_ad_knowledge(args: dict[str, Any]) -> dict[str, Any]:
    """语义搜索广告知识库 (RAG)"""
    query = args["query"]
    category = args.get("category")
    product = args.get("product")
    top_k = min(args.get("top_k", 5), 10)

    results = _simple_search(query, category, product, top_k)

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "query": query,
                "count": len(results),
                "results": results,
            }, ensure_ascii=False, indent=2),
        }]
    }


@tool(
    "get_knowledge_detail",
    "获取某条知识文档的完整内容。当 search_ad_knowledge 返回的摘要不够详细时，"
    "使用此工具获取完整文档内容。doce_id 来自 search_ad_knowledge 的返回结果。",
    {
        "doc_id": str,        # 知识文档ID（从 search_ad_knowledge 结果中获取）
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def get_knowledge_detail(args: dict[str, Any]) -> dict[str, Any]:
    """获取知识详情"""
    doc_id = args["doc_id"]

    for doc in MOCK_KNOWLEDGE:
        if doc["id"] == doc_id:
            return {
                "content": [{
                    "type": "text",
                    "text": json.dumps(doc, ensure_ascii=False, indent=2),
                }]
            }

    return {
        "content": [{"type": "text", "text": f"未找到文档 {doc_id}"}],
        "is_error": True,
    }


# ============================================================
# 创建 Server
# ============================================================

def create_ad_knowledge_mcp_server():
    """创建广告知识库 MCP Server"""
    return create_sdk_mcp_server(
        name="ad_knowledge",
        version="1.0.0",
        tools=[search_ad_knowledge, get_knowledge_detail],
    )
