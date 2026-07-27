---
name: report-generation
description: >
  报告生成技能。当用户需要生成客户报告、团队报告、行业分析报告、
  日报/周报/月报时触发。掌握报告模板、图表标准和格式化输出规则。
---

# 报告生成技能 (Report Generation)

## 触发场景
- "帮我生成XX客户的周报"
- "生成本周华东区运营报告"
- "做一个Q3的行业分析报告"
- "生成今日晨报"

## 报告类型与模板

### 1. 客户日报/周报

**数据获取**：
1. `mcp__crm_data__get_customer_detail` → 客户基础信息
2. `mcp__crm_data__query_consumption(customer_ids=[...], start_date=..., end_date=..., group_by="day", compare="mom")` → 消耗趋势+环比
3. `mcp__analytics__run_analysis(analysis_type="anomaly", params={...})` → 异常检测

**报告结构**：
```markdown
# {客户名称} {周/月}报 — {日期范围}

## 一、核心指标概览
| 指标 | 本期值 | 上期值 | 环比变化 |
|------|--------|--------|---------|
| 消耗 | ¥xxx | ¥xxx | +x% |
| ROI | x.x | x.x | +x% |

## 二、消耗趋势
(附趋势分析说明)

## 三、异常检测
(如有异常，列出异常点和原因)

## 四、优化建议
(3-5条具体可执行建议)
```

### 2. 团队日报

**数据获取**：
- `mcp__crm_data__search_customers(region=..., limit=100)` → 团队负责的全部客户
- 对每个客户的 `query_consumption` → 汇总消耗

**报告结构**：团队总消耗、环比变化、TOP10客户、异常客户列表、行动建议。

### 3. 行业分析报告

**数据获取**：
- `mcp__ad_knowledge__search_ad_knowledge(query="行业benchmark", category="strategy")`
- `mcp__analytics__run_analysis(analysis_type="trend", params={...})`
- 可选：加载 `deep-research` Skill 进行深度调研

### 4. 图表标准

- **趋势**：折线图（date × metric）
- **对比**：柱状图（客户/区域 × metric）
- **占比**：饼图/环形图
- **表格**：所有精确数值用表格

## 生成流程

1. 确认报告类型、时间范围、客户/团队范围
2. 调用数据工具获取原始数据
3. 调用分析工具做数据处理
4. 按模板组织内容（Markdown 格式）
5. 使用 Write 工具保存到 `/app/reports/{category}/{name}_{date}.md`
6. 询问用户是否需要推送（messaging MCP）
