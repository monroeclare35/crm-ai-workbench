"""
Analytics MCP Server — 数据分析引擎

提供趋势分析、异常检测、客户分层(RFM)、同期群分析、漏斗分析。
"""

from __future__ import annotations

import json
import random
from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations


# ============================================================
# Tool 实现
# ============================================================

@tool(
    "run_analysis",
    "执行数据分析。支持多种分析类型：趋势分析(trend)、异常检测(anomaly)、"
    "客户分层(rfm)、同期群分析(cohort)、漏斗分析(funnel)。"
    "根据分析类型传入不同参数。结果包含文字摘要、数据和可选图表数据。",
    {
        "analysis_type": str,   # 分析类型：trend/anomaly/rfm/cohort/funnel
        "params": dict,         # 分析参数，因类型而异
        "output_format": str,   # 输出格式：json(仅数据)/chart(仅图表)/both(两者)
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def run_analysis(args: dict[str, Any]) -> dict[str, Any]:
    """执行数据分析"""
    analysis_type = args["analysis_type"]
    params = args.get("params", {})
    output_format = args.get("output_format", "both")

    if analysis_type == "trend":
        result = _run_trend_analysis(params)
    elif analysis_type == "anomaly":
        result = _run_anomaly_detection(params)
    elif analysis_type == "rfm":
        result = _run_rfm_analysis(params)
    elif analysis_type == "cohort":
        result = _run_cohort_analysis(params)
    elif analysis_type == "funnel":
        result = _run_funnel_analysis(params)
    else:
        return {
            "content": [{"type": "text", "text": f"不支持的分析类型: {analysis_type}"}],
            "is_error": True,
        }

    output = {"analysis_type": analysis_type, "summary": result["summary"], "data": result["data"]}
    if output_format in ("chart", "both"):
        output["chart_data"] = result.get("chart_data", {})
    if result.get("insights"):
        output["insights"] = result["insights"]

    return {
        "content": [{"type": "text", "text": json.dumps(output, ensure_ascii=False, indent=2)}],
    }


# ============================================================
# 各分析类型实现
# ============================================================

def _run_trend_analysis(params: dict) -> dict:
    """趋势分析"""
    metric = params.get("metric", "cost")
    period = params.get("period", "daily")

    # Mock: 生成30天趋势数据
    dates = [f"2026-06-{d+28:02d}" for d in range(3)] + [f"2026-07-{d:02d}" for d in range(1, 28)]
    base = 100000 if metric == "cost" else 2.5
    data = []
    for i, date in enumerate(dates):
        noise = random.uniform(-0.15, 0.15)
        trend = 1 + i * 0.005  # 轻微上升趋势
        value = round(base * trend * (1 + noise), 2)
        data.append({"date": date, "value": value})

    # 判断趋势
    first_week = sum(d["value"] for d in data[:7])
    last_week = sum(d["value"] for d in data[-7:])
    change_pct = round((last_week - first_week) / first_week * 100, 1)
    direction = "上升" if change_pct > 3 else ("下降" if change_pct < -3 else "平稳")

    return {
        "summary": f"{metric} 近30天整体趋势：{direction}（变化 {change_pct:+.1f}%）。"
                   f"近7天均值 {round(last_week/7):,}，7天前均值 {round(first_week/7):,}。",
        "data": data,
        "chart_data": {"type": "line", "x_key": "date", "y_key": "value",
                       "title": f"{metric} 30天趋势"},
        "insights": [
            f"{metric} 近30天变化 {change_pct:+.1f}%",
            "无明显季节性波动",
        ],
    }


def _run_anomaly_detection(params: dict) -> dict:
    """异常检测"""
    metric = params.get("metric", "cost")
    threshold = params.get("threshold", 2.0)  # Z-score 阈值

    # Mock 异常点
    anomalies = [
        {"date": "2026-07-15", "value": 185000, "expected": 102000,
         "z_score": 3.2, "direction": "up", "reason": "新素材上线+大促活动"},
        {"date": "2026-07-22", "value": 48000, "expected": 103000,
         "z_score": -2.8, "direction": "down", "reason": "账户余额不足暂停投放"},
    ]

    return {
        "summary": f"检测到 {len(anomalies)} 个异常点（阈值={threshold}σ）。"
                   f"7月15日异常上升（新素材+大促），7月22日异常下降（余额不足）。",
        "data": anomalies,
        "chart_data": {"type": "scatter", "anomalies": anomalies},
        "insights": [
            "7月15日消耗暴增185%，检查是否为良性增长",
            "7月22日消耗骤降53%，需排查账户余额",
            "建议为TOP客户设置余额告警",
        ],
    }


def _run_rfm_analysis(params: dict) -> dict:
    """RFM 客户分层"""
    customers = params.get("customer_ids", ["C001", "C002", "C003", "C004", "C005"])

    # Mock 分层结果
    rfm_results = {
        "C001": {"recency": 1, "frequency": 28, "monetary": 2850000, "segment": "高价值客户"},
        "C002": {"recency": 5, "frequency": 15, "monetary": 1520000, "segment": "重要发展客户"},
        "C003": {"recency": 3, "frequency": 20, "monetary": 680000, "segment": "一般保持客户"},
        "C004": {"recency": 1, "frequency": 30, "monetary": 5200000, "segment": "重要价值客户"},
        "C005": {"recency": 2, "frequency": 25, "monetary": 8900000, "segment": "重要价值客户"},
    }

    segments = {}
    for cid in customers:
        r = rfm_results.get(cid, {})
        seg = r.get("segment", "未知")
        segments.setdefault(seg, []).append(cid)

    return {
        "summary": f"RFM分析完成，{len(customers)}个客户分为{len(segments)}层："
                   + "、".join(f"{k} {len(v)}个" for k, v in segments.items()),
        "data": [{"customer_id": cid, **rfm_results.get(cid, {})} for cid in customers],
        "chart_data": {"type": "scatter", "x": "frequency", "y": "monetary", "size": "recency"},
        "insights": [
            "C004、C005为最重要价值客户，建议配置专属服务",
            "C002有流失风险，建议加强回访和优惠激励",
        ],
    }


def _run_cohort_analysis(params: dict) -> dict:
    """同期群分析"""
    cohort_by = params.get("cohort_by", "month")

    return {
        "summary": f"按{cohort_by}分组同期群分析完成。"
                   "7月新增客户首月留存率72%，6月新增客户次月留存率58%，5月新增客户3月留存率45%。",
        "data": [
            {"cohort": "2026-05", "m0": 100, "m1": 68, "m2": 52, "m3": 45},
            {"cohort": "2026-06", "m0": 100, "m1": 72, "m2": 58},
            {"cohort": "2026-07", "m0": 100, "m1": 72},
        ],
        "chart_data": {"type": "heatmap", "title": "客户留存同期群分析"},
        "insights": [
            "6月新增客户留存优于5月，说明近期产品体验改善有效",
            "首月到次月流失最大（约30%），需加强Onboarding",
        ],
    }


def _run_funnel_analysis(params: dict) -> dict:
    """漏斗分析"""
    return {
        "summary": "客户转化漏斗：广告曝光 → 点击 → 留资 → 试投 → 正式签约。"
                   "整体转化率：曝光→点击 2.3%，点击→留资 8.5%，留资→试投 35%，试投→签约 62%。"
                   "最大瓶颈在'留资→试投'环节。",
        "data": [
            {"step": "广告曝光", "count": 1000000, "pct": 100},
            {"step": "点击", "count": 23000, "pct": 2.3},
            {"step": "留资", "count": 1955, "pct": 0.20},
            {"step": "试投", "count": 684, "pct": 0.068},
            {"step": "签约", "count": 424, "pct": 0.042},
        ],
        "chart_data": {"type": "funnel", "title": "客户转化漏斗"},
        "insights": [
            "留资→试投环节转化率仅35%，是最薄弱环节",
            "建议优化：缩短试投审批流程、提供新客激励政策",
        ],
    }


# ============================================================
# 创建 Server
# ============================================================

def create_analytics_mcp_server():
    """创建数据分析 MCP Server"""
    return create_sdk_mcp_server(
        name="analytics",
        version="1.0.0",
        tools=[run_analysis],
    )
