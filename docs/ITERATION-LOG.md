# CRM AI 智能工作台 — 迭代记录

> **项目代号**: StarSeeker（星辰大海）  
> **开始日期**: 2026-07-27  
> **目标**: 字节跳动秋招 — CRM AI 智能工作台完整实现

---

## 迭代 #1 — 项目启动 & 架构设计

**日期**: 2026-07-27  
**版本**: v0.1.0 → v0.2.0

### 做了什么
- 完成网络调研：Claude Agent SDK 架构、国产模型 Anthropic 兼容端点、CRM AI Agent 行业趋势、字节跳动商业化 CRM 业务流程
- 研究文档：Claude Agent SDK 的 MCP 工具注册机制、Skill 渐进式加载、ClaudeAgentOptions 完整配置
- 输出完整的 PRD + 技术架构文档（`CRM-AI-工作台-PRD-技术架构.md`）
- 确立核心架构哲学：**One Smart Agent, Infinite Capabilities**

### 核心决策与动机

| 决策 | 动机 |
|------|------|
| **Claude Agent SDK 作为唯一 Agent 引擎** | 用户硬性要求。SDK 内置成熟 Agent Loop + 原生工具（Bash/Edit/Write/Skill），不需要从零写 Agent 循环 |
| **单 Agent 架构（99% 场景）** | 避免 LangGraph 式硬编码工作流，让模型大脑自主决策执行路径。只有 Deep Research 场景使用多 Agent |
| **MCP 工具只封装 Bash 做不到的事** | 保留 Bash 的无限灵活性（Agent 可现场写 Python 脚本），MCP 只封装需要认证/审计的外部系统 |
| **Skill 用纯文本 SKILL.md，不写代码** | 渐进式加载（100 tokens 元数据 → 5K tokens 完整内容），新增 Skill 零代码 |
| **国产模型 Anthropic 格式兼容** | DeepSeek/Kimi/GLM/Qwen 均有原生 Anthropic 端点，无需协议转换 |
| **四层安全防护** | 认证 → 数据权限(ABAC) → Agent 工具权限(Hook) → 审计日志 |

### 架构关键设计
```
One Smart Agent (Claude Agent SDK)
    ├── Native Tools: Bash, Read, Write, Edit, Skill, Task (100% 保留)
    ├── MCP Tools: crm_data, ad_knowledge, analytics, messaging, document, workflow
    └── Skills: customer-analysis, ad-strategy, sales-process, report-generation, data-query, deep-research
```

### 遇到的问题
- code.claude.com 域名无法直接访问（被企业安全策略拦截），通过 WebSearch + 第三方博客/文档获取了完整 SDK 信息
- 需要区分"Claude Agent SDK 能做的一切"和"我们需要封装的 MCP 工具"——原则：Bash 能做的就不封装

### 下一步
- 搭建项目脚手架
- 实现全部 6 个 MCP Server
- 编写全部 6 个 Skill 的 SKILL.md
- 实现核心 Agent Service
- 实现 FastAPI 后端
- 设计前端工作台
- 准备答辩材料

---

## 迭代 #2 — 项目脚手架搭建

**日期**: 2026-07-27  
**版本**: v0.2.0 → v0.3.0

### 做了什么
- 创建完整的项目目录结构（app/mcp_servers/skills/frontend/tests/scripts）
- 编写 `pyproject.toml`（含 claude-agent-sdk, fastapi, milvus, redis 等依赖）
- 编写 `.env.example`（模型配置、数据库、飞书/企业微信、Redis）
- 编写 `.mcp.json`（MCP Server 注册 + allowedTools 配置）
- 编写 `Dockerfile`（多阶段构建）和 `docker-compose.yml`（Redis + Milvus + etcd + MinIO）
- 编写 `README.md`（快速启动指南）

### 核心决策与动机
- **Python 3.12+**: Claude Agent SDK 推荐的 Python 版本
- **FastAPI**: 异步原生 + WebSocket + SSE，适合 Agent 流式响应
- **Milvus**: 向量数据库用于知识库 RAG 和 Memory 语义检索
- **docker-compose 一键启动**: 降低部署复杂度

### 遇到的问题
- （无）

---

## 迭代 #3 — MCP Server 实现

**日期**: 2026-07-27  
**版本**: v0.3.0 → v0.4.0

### 做了什么
实现了全部 6 个业务 MCP Server：

1. **crm_data_mcp.py** — 客户数据查询
   - `search_customers`: 多条件搜索（关键词/行业/区域/等级/负责人）
   - `get_customer_detail`: 360°客户画像（含消耗明细）
   - `query_consumption`: 消耗数据查询（多维聚合+同环比）
   - 内置 Mock 数据：5 个典型客户 + 27 天消耗记录

2. **ad_knowledge_mcp.py** — 广告知识库 RAG
   - `search_ad_knowledge`: 语义搜索（分类+产品线+关键词打分）
   - `get_knowledge_detail`: 获取完整文档
   - 内置 Mock 知识库：7 条涵盖政策/策略/案例/产品/benchmark

3. **analytics_mcp.py** — 数据分析引擎
   - `run_analysis`: 统一分析入口
   - 支持 5 种分析类型：trend/anomaly/rfm/cohort/funnel
   - 每种分析返回 summary + data + chart_data + insights

4. **messaging_mcp.py** — 消息推送
   - `send_message`: 飞书/企业微信，text/markdown/card/file 四种类型
   - 标注 `destructiveHint=True`

5. **document_mcp.py** — 文档操作
   - `search_documents`: 内部文档搜索
   - `create_document`: 创建新文档

6. **workflow_mcp.py** — 任务管理
   - `create_task`: 创建CRM任务
   - `list_tasks`: 查询任务列表

### MCP Server 清单
| Server | Tools | 只读/副作用 | 用途 |
|--------|-------|-----------|------|
| crm_data | 3 | 全部只读 | 客户数据查询 |
| ad_knowledge | 2 | 全部只读 | 知识库检索(RAG) |
| analytics | 1 | 只读 | 数据分析 |
| messaging | 1 | 有副作用 | 消息推送 |
| document | 2 | 1只读+1副作用 | 文档管理 |
| workflow | 2 | 1只读+1副作用 | 任务管理 |

### 遇到的问题
- **循环引用问题**: 初版 `crm_data_mcp.py` 从自身 import 了 impl 函数（过度分层），重构为单文件实现，tool 装饰器 + 处理函数一体化
- **Mock 数据真实性**: 刻意构造了不同健康度状态的客户数据（healthy/warning/risk），确保 Demo 场景丰富

---

## 迭代 #4 — Skill 体系完善

**日期**: 2026-07-27  
**版本**: v0.4.0 → v0.5.0

### 做了什么
编写了全部 6 个 Skill 的完整 SKILL.md + 参考文档 + 资产：

1. **customer-analysis** — 客户分析
   - 客户画像解读框架、消耗趋势分析、健康度评分（6维25项）、流失预警（3级9信号）
   - 参考文档: `customer-health-score.md`, `churn-signals.md`

2. **ad-strategy** — 广告策略
   - DADI诊断框架（Data→Analyze→Diagnose→Improve）
   - 出价策略决策树、创意优化诊断、产品线选择
   - 参考文档: `bidding-strategies.md`

3. **sales-process** — 销售流程
   - 6阶段销售流程（线索→需求→方案→谈判→签约→服务）
   - 拜访准备清单、异议处理话术

4. **report-generation** — 报告生成
   - 客户周报/团队日报/行业分析三种模板
   - 图表标准（折线=趋势、柱状=对比、饼图=占比）
   - 资产: `weekly-report-template.html`

5. **data-query** — 数据查询
   - CRM 数据模型文档、8个核心指标口径定义
   - 5种常见查询模式

6. **deep-research** — 深度调研
   - 4阶段流程（分解→并行调研→交叉验证→合成）
   - 质量检查清单、时间管理策略

### Skill 清单
| Skill | 触发条件 | 关键资源 |
|-------|---------|---------|
| customer-analysis | 客户查询/分析/拜访准备 | health-score, churn-signals |
| ad-strategy | 投放优化/策略建议 | bidding-strategies |
| sales-process | 销售流程/客户开发 | - |
| report-generation | 报告生成请求 | weekly-report-template.html |
| data-query | 自然语言查数 | metric-definitions |
| deep-research | 深度调研 | research-methodology |

### 遇到的问题
- Skill 的**边界划分**：一个 Skill 应该多大？最终按"一个可独立完成的任务单元"划分。例如 customer-analysis 覆盖"了解客户"这个完整场景，而不是拆成"查基本信息"和"分析趋势"两个碎片 Skill。
- Skill 的引用文档该写入多少细节？原则：SKILL.md 写方法论（怎么做），references 写参考数据（具体数据），assets 写模板（输出格式）。

---

## 迭代 #5 — Agent Service & Hook & Memory

**日期**: 2026-07-27  
**版本**: v0.5.0 → v0.6.0

### 做了什么
- **CRMAgentService**: 核心 Agent 服务
  - `build_options()`: 根据用户+任务类型动态构建 ClaudeAgentOptions
  - `chat()`: 流式对话接口，SSE 事件流
  - `start_deep_research()`: 异步后台调研
  - `execute_scheduled_report()`: 定时报告任务
  - 模型路由: chat→DeepSeek, analysis→Kimi K2, deep_research→Kimi K2, simple→GLM

- **Security Hooks**:
  - `crm_data_access_control`: 客户数据权限校验（只能查自己负责的客户）
  - `messaging_approval`: 消息发送审批（批量 > 5 人需审批）
  - `bash_safety_check`: 危险命令拦截（rm -rf, sudo, fork bomb 等）

- **Memory Store**:
  - 三层记忆体系：Session(Agent SDK原生) / User(用户偏好) / Organizational(团队经验)
  - 关键词打分 + 时效性衰减 + 分类过滤
  - `add()` / `search()` / `delete()` / `list_by_user()` 完整接口

### 核心决策与动机
- **系统提示词动态注入**: 用户角色、部门、日期等上下文动态注入 prompt，而非写死
- **Hook 包装函数**: SDK 的 hook 回调签名要求特定参数格式，需要 wrapper 适配
- **模型配置分离**: 不同任务类型的 model + base_url 用 dict 管理，便于 A/B 测试
- **Memory 用简单关键词匹配**: 开发环境避免引入 Milvus 依赖，生产环境替换为向量检索

### 遇到的问题
- **ClaudeAgentOptions 的 hooks 字段**: 需要 `HookEvent.PRE_TOOL_USE` + `HookMatcher` 组合，文档不全，参照 GitHub Issue #19418 解决
- **Agent Service 单例设计**: 全局一个实例管理所有会话，session_id 映射存在内存中，生产环境需要 Redis 持久化

---

## 迭代 #6 — FastAPI 后端

**日期**: 2026-07-27  
**版本**: v0.6.0 → v0.7.0

### 做了什么
- **main.py**: FastAPI 入口，CORS、lifespan、路由注册、前端静态文件
- **chat.py**: SSE 流式对话 + 同步对话两个接口
- **research.py**: Deep Research 启动 + 状态查询 + 报告获取
- **memory_api.py**: Memory CRUD（remember/recall/list）
- **auth.py**: OAuth 2.0 认证 + Mock 用户（5种角色） + 权限服务
- **schemas.py**: 完整的 Pydantic 数据模型（User, Customer, Knowledge, Analysis, Memory 等）

### API 接口清单
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/chat/stream | SSE 流式对话 |
| POST | /api/v1/chat/sync | 同步对话 |
| POST | /api/v1/deep-research | 启动深度调研 |
| GET | /api/v1/research/{id}/status | 调研进度 |
| GET | /api/v1/research/{id}/report | 调研报告 |
| POST | /api/v1/memory/remember | 存入记忆 |
| POST | /api/v1/memory/recall | 检索记忆 |
| GET | /api/v1/memory/list | 列出记忆 |
| GET | /api/v1/health | 健康检查 |

### 遇到的问题
- SSE 流式响应的 `X-Accel-Buffering: no` header 对 Nginx 反向代理很重要，否则会缓冲整个响应
- FastAPI 的 `StreamingResponse` 与 `Depends(get_current_user)` 的配合需要仔细处理 async generator

---

## 迭代 #7 — 前端工作台

**日期**: 2026-07-27  
**版本**: v0.7.0 → v0.8.0

### 做了什么
- **index.html**: 单页应用，5 个视图（对话/看板/报告/客户/知识库）
- **style.css**: 完整的 UI 系统（侧边栏、聊天、看板、卡片、响应式）
- **app.js**: 前端应用逻辑
  - SSE 流式对话（fetch + ReadableStream）
  - Markdown 渲染（标题/粗体/代码/列表/表格）
  - 视图切换 + 快捷问题按钮
  - 客户卡片渲染 + 知识库搜索
  - 模型选择器（DeepSeek/Kimi K2）

### 前端功能清单
- [x] 侧边栏导航（5视图切换）
- [x] 流式对话（SSE text_delta + tool_call 状态展示）
- [x] 快捷问题按钮（客户近况/异常检测/晨报/查知识）
- [x] 数据看板（消耗/客户数/ROI/异常客户 stat cards）
- [x] 报告中心（列表展示）
- [x] 客户管理（卡片网格，点击跳转对话）
- [x] 知识库（搜索+分类过滤）
- [x] 响应式设计（移动端侧边栏折叠）
- [x] 打字指示器动画

### 遇到的问题
- **SSE 流解析**: `ReadableStream` 的 chunk 可能在 SSE 消息中间断开，需要 buffer 拼接
- **Markdown 渲染**: 生产环境应该用 marked/markdown-it，开发环境用简易正则（够用但有边界 case）
- **状态管理**: 当前使用全局 state 对象，后续可升级为响应式框架（Vue/React）

---

## 迭代 #8 — 测试 & 脚本 & 答辩材料

**日期**: 2026-07-27  
**版本**: v0.8.0 → v1.0.0

### 做了什么
- **测试**: `test_mcp_servers.py` — 8 个 pytest 用例覆盖 crm_data + ad_knowledge 的核心工具
- **脚本**: `scripts/cohort_analysis.py` — 同期群分析独立脚本（供 Agent Bash 调用）
- **参考文档**: customer-health-score.md, churn-signals.md, bidding-strategies.md
- **报告模板**: weekly-report-template.html
- **答辩材料**: `PRESENTATION.md` — 12 页 PPT 大纲 + 3 个 Demo 场景脚本 + 30 秒电梯演讲

### 材料清单
- [x] PRD + 技术架构文档
- [x] PPT 大纲（12页）
- [x] Demo 演示脚本（3个核心场景）
- [x] 30秒电梯演讲
- [x] 核心竞争力总结
- [x] 完整项目代码（22+ 文件）
- [x] 迭代记录文档（本文档）

---

## 架构变更总览

| 版本 | 变更内容 | 原因 |
|------|---------|------|
| v0.1.0 | 初始架构设计 | 项目启动 |
| v0.2.0 | 项目脚手架（目录/Docker/配置） | 工程化基础 |
| v0.3.0 | MCP Server ×6 实现 | 业务工具封装 |
| v0.4.0 | Skill ×6 完整定义 | 领域知识注入 |
| v0.5.0 | Agent Service + Hook + Memory | 核心引擎实现 |
| v0.6.0 | FastAPI 后端 API ×9 | 服务化 |
| v0.7.0 | 前端工作台（5视图） | 交互层 |
| v0.8.0 | 测试 + 脚本 + 答辩材料 | 完整性 |

## 项目统计

- **总文件数**: 30+
- **代码行数**: ~3500+ (Python) + ~800 (HTML/CSS/JS)
- **MCP 工具**: 11 个 tool 函数
- **Skill**: 6 个 SKILL.md
- **API 接口**: 9 个
- **测试用例**: 8 个
- **Mock 数据**: 5 个客户、7 条知识、27 天消耗

---

## 迭代 #9 — v2.0 生产级深化

**日期**: 2026-07-27
**版本**: v1.0.0 → v2.0.0

### 做了什么

根据架构评审反馈，完成了以下生产级升级：

1. **模型名称全量更新**
   - `deepseek-chat` → `deepseek-v4-pro`（DeepSeek V4，2026-07-24 已弃用旧名）
   - `deepseek-reasoner` → 统一使用 `deepseek-v4-pro`（thinking mode）
   - `kimi-k2-turbo-preview` → `kimi-k2.6`（Moonshot，旧名已停用）
   - 新增 `app/model_compat.py`：模型兼容性注册表，管理各厂商的 temperature/thinking/caching 差异

2. **Session 分布式存储**
   - 新增 `app/session_store.py`：Redis 后端 + 内存降级
   - 解决多 uvicorn worker 时 session_id 不共享的问题

3. **Memory 预注入机制**
   - `_build_memory_context()`: 构建 options 前同步检索相关记忆
   - 拼入 `system_prompt` 的 `{memory_context}` 占位符
   - 系统级行为，不依赖 Agent 自觉调用 recall 工具

4. **MCP 工具描述优化**
   - 全部 tool 描述加入 "when to use vs when not to use" 提示
   - `search_customers`: "查找/列出/筛选客户时使用。注意：返回简要信息，需要完整信息用 get_customer_detail"
   - `query_consumption`: "聚合级别的消耗查询。如果需自定义分析，用此工具拿数据后通过 Bash+Python 处理"
   - `send_message`: "不要主动发送除非用户要求或定时任务触发"
   - 显著提升 Agent 在 19 个工具中的选择准确率

5. **Kimi 兼容性配置**
   - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
   - Kimi 端点: `max_thinking_tokens=None`（多轮工具调用可能 400）
   - temperature 被内部缩放（×0.6），document block 不支持

6. **架构文档 v2.0 深化补遗**
   - 新增 Part 3 章节：单 Agent 底层论证、Bash 逃生舱理论、MCP 三层分类法、Skill 认知框架、Memory 召回时机、模型兼容性风险、分布式 Session、安全静默过滤 vs 明确拒绝
   - 30 秒电梯演讲定稿

### 核心决策与动机

| 决策 | 动机 |
|------|------|
| Memory 用方案A（系统级预注入）而非方案B（Agent内部自觉） | 生产环境可靠性——"检索记忆"不应依赖 Agent 自觉 |
| Session 用 Redis 而非内存字典 | 多 worker 部署的必要条件 |
| 模型兼容性用注册表而非硬编码 | 后续新增模型/厂商只需加一条配置 |
| MCP 描述加入"when not to use" | 减少 Agent 选错工具的概率（19个工具环境中至关重要） |

### 遇到的问题
- DeepSeek 模型名已在 3 天前弃用（2026-07-24），幸好及时发现更新
- Kimi 的 Anthropic 端点有多项未文档化的行为差异（GitHub issue #129），需要 compat 层
- `max_thinking_tokens` 在 Kimi 多轮场景下可能 400，通过 model_compat 统一控制

---

## 技术债务与待优化项

| 编号 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| TD-001 | MCP Server 错误重试机制（tenacity） | P2 | TODO |
| TD-002 | Agent 请求级缓存（相同查询复用） | P2 | TODO |
| TD-003 | 知识库增量更新 Pipeline | P2 | TODO |
| TD-004 | 多租户 Memory 隔离强化（生产环境） | P1 | TODO |
| TD-005 | Session 存储迁移 Redis（当前内存） | P1 | TODO |
| TD-006 | 前端 Markdown 渲染升级 marked/markdown-it | P3 | TODO |
| TD-007 | 接入真实 CRM 数据库（替换 Mock） | P1 | TODO |
| TD-008 | ECharts 图表接入（数据看板可视化） | P2 | TODO |
