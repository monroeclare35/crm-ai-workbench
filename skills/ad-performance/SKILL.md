---
name: ad-performance
description: >
  广告效果诊断。当用户询问投放数据、异常检测、趋势分析、
  账户诊断时触发。覆盖全产品线的消耗/ROI/CTR/CVR多维度分析。
---

# 广告效果诊断

## 触发
- "今天消耗有没有异常？"
- "XX账户近7天数据怎么样？"
- "对比一下A和B两个客户的投放效率"

## 方法论

### 1. 单账户诊断
调 `ad_platform__get_account_info` + `ad_platform__query_metrics(period='7d', compare='wow')`:
- 消耗趋势 + 环比
- CTR/CVR/ROI 是否在行业基准±20%内
- 素材新鲜度（近7天新素材占比）
- 预算利用率（是否撞线）

### 2. 异常检测
调 `analytics__run_analysis(type='anomaly', threshold=2.0)`:
- Z-score>2: 显著上升（可能是爆量素材/大促）
- Z-score<-2: 显著下降（余额不足/素材被拒/计划暂停）

### 3. 多账户对比
调 `ad_platform__query_metrics(customer_ids=[...], group_by='customer')` → 按ROI排序 → 标出TOP3和BOTTOM3

## 输出格式
```
## {客户} 效果诊断 — {日期范围}
| 指标 | 当前 | 环比 | 行业基准 | 状态 |
|------|------|------|---------|------|
| 消耗 | ¥xx | +x% | - | 🟢 |
| ROI | x.x | -x% | x.x | 🔴 |
| CTR | x.x% | +x% | x.x% | 🟢 |
异常: 1个 (ROI低于基准30%)
建议: 详见bidding-optimization技能
```
