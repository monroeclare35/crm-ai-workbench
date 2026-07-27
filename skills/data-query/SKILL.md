---
name: data-query
description: >
  数据查询技能。当用户用自然语言查询数据、需要了解数据模型和指标口径、
  进行数据探索时触发。掌握 CRM 数据模型、指标定义和常见查询模式。
---

# 数据查询技能 (Data Query)

## 触发场景
- "查一下XX的消耗""华东区上个月的消耗是多少？"
- "帮我查几个数""对比一下这几个客户的ROI"
- 任何涉及数据查询的自然语言请求

## CRM 数据模型

### 核心实体

```
Customer (客户)
├── id, name, industry, sub_industry, region, scale, level
├── owner (销售负责人)
├── contract_status, contract_start, contract_end
├── health_status, health_score
└── Accounts (投放账户)
    └── id, product, status, daily_budget
        └── Consumption (消耗记录)
            └── date, cost, impression, click, ctr, cvr, roi
```

### 指标口径定义

| 指标 | 英文 | 计算公式 | 说明 |
|------|------|---------|------|
| 消耗 | cost | SUM(投放账户消耗) | 含代理服务费 |
| 曝光 | impression | COUNT(广告展示) | 去重后 |
| 点击 | click | COUNT(广告点击) | 含重复点击 |
| 点击率 | CTR | click / impression × 100% | 百分比 |
| 转化率 | CVR | 转化数 / click × 100% | 百分比 |
| ROI | ROI | GMV / cost | 比值，非百分比 |
| 千次展示成本 | CPM | cost / impression × 1000 | 元 |
| 单次点击成本 | CPC | cost / click | 元 |

### 常见查询模式

1. **单客户趋势**："XX客户近30天消耗"
   → `query_consumption(customer_ids=["XX"], start_date="30天前", end_date="今天", group_by="day")`

2. **多客户对比**："对比A、B、C的ROI"
   → `query_consumption(customer_ids=["A","B","C"], group_by="customer", metrics=["roi"])`

3. **区域汇总**："华东区本月消耗"
   → 先 `search_customers(region="华东区")` 拿到客户列表
   → 再 `query_consumption(customer_ids=[...], group_by="customer")`

4. **同环比**："本月消耗环比变化"
   → `query_consumption(..., compare="mom")`

5. **异常检测**："哪些客户消耗异常？"
   → `run_analysis(analysis_type="anomaly", params={"metric":"cost","threshold":2.0})`

## 查询优化原则

1. **先缩小范围再查详情**：先 search 拿到客户列表，再对重点客户 get_detail
2. **聚合优于明细**：group_by="day"/"week" 比拉全量明细高效
3. **同环比一次完成**：用 compare 参数，不要查两遍再自己算
4. **数据异常先排查**：如果查询结果为空或异常，检查时间范围、客户ID是否正确
