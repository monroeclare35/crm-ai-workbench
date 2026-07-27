#!/usr/bin/env python3
"""
同期群分析脚本 — 供 Agent 通过 Bash 工具调用

用法:
  python cohort_analysis.py --input data.json --group-by month --output result.json

输入: JSON 数组，每条记录含 customer_id, first_payment_date, monthly_cost
输出: 同期群留存矩阵
"""

import json
import argparse
from collections import defaultdict
from datetime import datetime


def run_cohort_analysis(records: list[dict], group_by: str = "month") -> dict:
    """执行同期群分析"""
    # 按 cohort 分组
    cohorts = defaultdict(list)

    for r in records:
        first_date = datetime.fromisoformat(r["first_payment_date"])
        if group_by == "month":
            cohort_key = first_date.strftime("%Y-%m")
        elif group_by == "week":
            cohort_key = first_date.strftime("%Y-W%W")
        else:
            cohort_key = first_date.strftime("%Y-%m-%d")

        cohorts[cohort_key].append(r)

    # 计算每个 cohort 的留存
    result = []
    for cohort, members in sorted(cohorts.items()):
        total = len(members)
        if total == 0:
            continue

        # 计算各期的活跃客户数
        retention = {"cohort": cohort, "size": total, "periods": []}

        # 简化：根据 monthly_cost 字段判断是否活跃
        active_per_period = defaultdict(int)
        for m in members:
            for period, cost in enumerate(m.get("monthly_costs", [])):
                if cost > 0:
                    active_per_period[period] += 1

        max_periods = max(active_per_period.keys()) + 1 if active_per_period else 0
        for p in range(max_periods):
            count = active_per_period.get(p, 0)
            pct = round(count / total * 100, 1)
            retention["periods"].append({"period": p, "active": count, "pct": pct})

        result.append(retention)

    return {
        "group_by": group_by,
        "total_cohorts": len(result),
        "cohorts": result,
    }


def main():
    parser = argparse.ArgumentParser(description="同期群分析")
    parser.add_argument("--input", required=True, help="输入 JSON 文件路径")
    parser.add_argument("--group-by", default="month", choices=["month", "week", "day"])
    parser.add_argument("--output", default="cohort_result.json", help="输出文件路径")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as f:
        records = json.load(f)

    result = run_cohort_analysis(records, args.group_by)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"同期群分析完成: {len(result['cohorts'])} 个 cohort → {args.output}")


if __name__ == "__main__":
    main()
