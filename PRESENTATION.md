# 秋招答辩材料 — CRM AI 智能工作台

## PPT 大纲（建议 10-12 页）

### Slide 1: 封面
- **标题**: CRM AI 智能工作台 — 让 AI 重新定义商业销售
- **副标题**: 基于 Claude Agent SDK 的 AI Native 智能工作台
- **候选人**: [姓名] | 字节跳动 2027 秋招

### Slide 2: 问题陈述 (The Problem)
- 客户数据、广告知识、营销策略分散在多个系统
- 销售/运营每天花费 40% 时间在"查信息、找资料、写报告"
- 现有工具是"记录系统"，不是"行动系统"
- **核心洞察**: 用户需要的是"端到端的智能服务"，不是"更多系统"

### Slide 3: 产品愿景 (The Vision)
- **一句话**: 用大模型重新定义 CRM — 从"人找数据"到"AI 推送决策"
- **四个关键词**: 对话即界面 · 知识即服务 · 数据即洞察 · AI 即行动
- **定位**: 销售/运营/管理者的 AI Native 工作台

### Slide 4: 核心场景 (Use Cases)
- 🔍 **自然语言查数**: "华东区教育行业近30天消耗TOP10" → 秒级返回
- 💡 **智能策略生成**: "XX客户ROI下降怎么办？" → 数据+知识→建议
- 📋 **自动报告**: "生成本周运营周报" → Agent 编排查数→分析→写报告→推送
- 🔬 **Deep Research**: "教育行业2026广告趋势" → 多Agent并行调研→交叉验证→报告

### Slide 5: 架构哲学 (Architecture Philosophy)
- **核心信条**: One Smart Agent, Infinite Capabilities
- **对比**:
  - ❌ LangChain/LangGraph: 硬编码 DAG，Agent 是提线木偶
  - ❌ 传统多Agent: 编排复杂，调试困难
  - ✅ **我们的方案**: 一个超级大脑，保留全部原生能力，按需调用工具

### Slide 6: 技术架构全景
```
用户自然语言
    ↓
Claude Agent SDK (大脑)  ← 自主决策每一步
    ├── Bash/Write/Edit/Read (原生工具 = 无限灵活)
    ├── 6个 MCP Server (业务工具 = 接入外部系统)
    └── 6个 Skill (领域知识 = 教Agent怎么思考)
    ↓
结果: 数据查询 · 策略建议 · 报告文件 · 消息推送
```

### Slide 7: 为什么选 Claude Agent SDK？
| 关键能力 | 价值 |
|---------|------|
| 内置 Agent Loop | 不用自己写工具调用循环 |
| 原生 Bash + 文件操作 | Agent 可以现场写脚本，灵活度拉满 |
| MCP 一等公民 | SDK 内嵌 Server 零进程开销 |
| Skill 渐进式加载 | 20个Skill仅占2000 tokens上下文 |
| 国产模型兼容 | DeepSeek/Kimi/GLM/Qwen 改URL即用 |

### Slide 8: MCP 工具 & Skill 体系
- **MCP (手)**: crm_data(查客户/消耗) · ad_knowledge(知识RAG) · analytics(分析) · messaging(推送) · document(文档) · workflow(任务)
- **Skill (脑)**: customer-analysis · ad-strategy · sales-process · report-generation · data-query · deep-research
- **原则**: MCP="能做什么", Skill="怎么做" — 完全解耦

### Slide 9: 安全架构
- 四层防护: 认证(SSO) → 数据权限(ABAC) → Agent工具权限(Hook) → 审计日志
- PreToolUse Hook: 实时拦截越权访问
- 数据脱敏: PII检测 + Prompt注入防御

### Slide 10: 国产模型策略
- 五模型全覆盖: DeepSeek/Kimi/GLM/Qwen/豆包
- Anthropic 原生格式，零协议转换
- 按任务类型智能路由: 简单→GLM, 分析→Kimi, 编码→DeepSeek

### Slide 11: 项目亮点总结
1. ⚡ **架构先进**: Claude Agent SDK 核心，非 LangChain 工作流
2. 🧠 **真正的 Agent**: 大脑自主决策，不是 if-else 状态机
3. 🔧 **保留原生灵活**: Bash/Edit/Write 一个不少
4. 🌐 **国产模型全兼容**: 改 URL 即切换
5. 🛡️ **生产级安全**: 四层防护 + Hook 实时鉴权
6. 📦 **完整可运行**: 前端+后端+MCP+Skill+测试 全部就绪

### Slide 12: 展望 & Q&A
- 短期: 接入真实CRM数据源，灰度上线
- 中期: Memory沉淀团队最佳实践，Agent越用越聪明
- 长期: 从"辅助决策"到"自主执行"，AI Native CRM 2.0

---

## Demo 演示脚本

### 场景1: 销售查客户
```
用户: "帮我看看杭州鲸灵最近怎么样？"
Agent:
  1. 调用 get_customer_detail("C002")
  2. 调用 query_consumption(["C002"], start=30天前, end=今天)
  3. 生成结构化分析（基础信息 + 消耗趋势 + 健康度评估 + 风险提示）
```

### 场景2: 智能策略
```
用户: "C002的ROI在下降，帮我分析原因并给建议"
Agent:
  1. 调用 get_customer_detail 获取客户画像
  2. 调用 query_consumption(compare="mom") 获取环比数据
  3. 调用 search_ad_knowledge("游戏行业ROI优化") 获取行业知识
  4. 综合数据+知识 → 生成诊断和建议
```

### 场景3: 自动报告
```
用户: "生成本周华东区运营周报"
Agent:
  1. search_customers(region="华东区") → 客户列表
  2. 对每个客户 query_consumption → 消耗数据
  3. run_analysis(type="anomaly") → 异常检测
  4. Write 保存报告到 /app/reports/
  5. 询问是否推送 → send_message 飞书推送
```

---

## 核心竞争力陈述（30秒电梯演讲）

"我做的 CRM AI 工作台，核心创新在于**架构哲学**——不是传统的 LangGraph 硬编码工作流，而是基于 **Claude Agent SDK** 打造了一个真正的智能大脑。Agent 保留了 Bash、文件操作等全部原生能力，同时通过 MCP 封装了 CRM 数据和广告知识库，通过 Skill 注入领域知识。这让它能像 Claude Code 写代码一样灵活地处理 CRM 场景——从查数、分析、策略到生成报告，Agent 自己决定每一步该做什么，而不是被预设的 DAG 框死。支持 DeepSeek、Kimi 等全部国产模型，改 URL 就能切换。整个项目从前端到后端、从 MCP 到 Skill、从安全 Hook 到测试，全部可运行。"
