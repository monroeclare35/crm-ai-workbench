# 面试 QA：广告 AI 策略 Agent 工作台

---

## Q1: 你这个架构为什么是单 Agent，而不是多 Agent？现在行业不都在搞 Multi-Agent 吗？

**做了什么：**
整个系统只有一个 Agent 大脑（Claude Agent SDK），负责所有任务。MCP 工具是它的"手"，Skill 是它的"脑内知识"。不用编排器、不写工作流 DAG。

**关键动作：**
1. 刻意不引入 LangGraph/CrewAI 等多 Agent 框架
2. 所有业务能力封装为 MCP 工具（6 个 Server / 11 个 tool）和 Skill（6 个 SKILL.md）
3. 设置 `max_turns=10` 让 Agent 在同一轮对话中自主多步推理
4. Agent 每次遇到问题自己决定调用什么工具、什么顺序——不预设流程

**结果如何：**
Agent 在一次对话中自主完成了"并行搜索知识库 + 查客户详情 + 查行业基准 + 写文件 + 推消息"的 5 步操作链。全程无人工干预、无预设 DAG。如果换成多 Agent，这 5 步至少需要 3 个 Agent + 1 个编排器，上下文割裂且调试困难。

**一句话：** 单 Agent 架构不是说"不要分工"，而是说"不要让框架替模型做决定"——Agent 大脑自己分工。

---

## Q2: 为什么选 Claude Agent SDK 而不是 LangChain / LangGraph？

**做了什么：**
技术选型时对比了 LangChain、LangGraph、OpenAI Agent SDK、Dify，最终选择 Claude Agent SDK v0.2.128 作为核心引擎。

**关键动作：**
1. 研究了 SDK 的 Agent Loop 机制——发现它和 Claude Code 共享内核，每天几百万开发者验证过
2. 保留 SDK 全部原生工具（Bash/Write/Edit/Read/Skill/Task），不做阉割
3. 通过 `create_sdk_mcp_server()` 把业务工具注册为 MCP Server，零进程开销
4. 用 `include_partial_messages=True` 捕获 thinking/tool_call 事件做实时的 Agent Trace
5. 通过改 `ANTHROPIC_BASE_URL` 接入 DeepSeek V4 Pro，零协议转换

**结果如何：**
LangChain/LangGraph 的核心问题是"预定义流程"——产品经理想清楚、程序员写成 DAG、用户只能走预设路径。Claude Agent SDK 的 Agent Loop（感知→规划→工具执行→反思→下一步）让模型自己做决策。实测中 Agent 会"发现知识库缺数据 → 换关键词重新搜索 → 还是没有 → 诚实告知用户"，这种动态调整在 LangGraph 里需要把所有分支都写成代码。

**一句话：** LangChain 是给 Agent 套缰绳，Claude Agent SDK 是给 Agent 发驾照。

---

## Q3: Agent 怎么证明它是真 Agent 而不是套壳大模型聊天？

**做了什么：**
用两个端到端测试验证 Agent 确实在调用工具、操作文件、产生产出物，而非仅仅生成文本。

**关键动作：**
1. 测试 1：让 Agent "用 Write 工具创建 /app/proof.html，写入 5 个客户数据"。Agent 并行调用了 5 次 `get_customer_detail`，然后用 Write 创建了完整的 HTML 文件
2. 测试 2：让 Agent "用 Read 工具读回 /app/proof.html 的前 10 行"。Agent 调 Read 返回了真实的文件内容（`<!DOCTYPE html>`, `<title>I AM AN AGENT</title>`, `#0d1117` 背景色）
3. 后端的 health endpoint 返回 `claude_path: /usr/local/bin/claude`、`sdk_ready: true`、`node_version: v22.23.1`，证明 CLI 引擎在运行
4. Agent Trace 面板实时显示 Agent 的 thinking 过程 + tool_call 事件（非模拟，来自 SDK 的 `content_block_start/tool_use` 事件）

**结果如何：**
聊天机器人只能描述 HTML 长什么样。Agent 真的写了文件、读回来、验证内容一致。文件真实存在于 Render 容器磁盘上。前后两次对话之间 Agent 记得上下文（"刚才创建的文件"）。

**一句话：** 聊天机器人说"我可以帮你写个 HTML"，Agent 说"写好了，路径是 /app/proof.html，要看看内容吗？"

---

## Q4: MCP 工具和 Skill 是怎么设计的？它们的边界在哪？

**做了什么：**
MCP 工具 = "能做什么"（外部系统接入），Skill = "怎么做"（领域方法论注入）。两者完全解耦，Agent 按需组合。

**关键动作：**
1. MCP 工具设计遵循三层分类法：
   - 原子操作（`search_customers`、`send_message`）：细粒度，Agent 灵活组合
   - 聚合查询（`query_consumption`）：把计算推给数据库，因为百万行数据不能传回 Agent 处理
   - 复合操作（`create_task`）：封装事务边界，避免 Agent 手动处理分布式一致性问题
2. Skill 用纯文本 SKILL.md（渐进式加载：100 tokens 元数据 → 5K tokens 完整内容），精确引用 MCP 工具名
3. 4 个 MCP Server（crm_data/ad_knowledge/analytics/messaging）+ 6 个 Skill（creative-generation/search-monetization/bidding-optimization/ad-performance/campaign-builder/competitor-analysis）
4. 封装原则：Bash 能解决的（写 Python 脚本做数据处理）不封装为 MCP，只封装需要认证/审计的外部系统

**结果如何：**
20 个 Skill 只占启动上下文 ~2000 tokens。新增 Skill 只需添加一个 SKILL.md 文件，零代码改动。Skill 里精确写明了 `调用 mcp__crm__get_customer_detail` 等步骤，让 Skill 从"泛泛指导"变成"可执行 SOP"。

**一句话：** MCP 是手，Skill 是脑。手决定边界（能碰什么系统），脑决定行为（这场景该怎么思考）。

---

## Q5: 安全与数据权限怎么做的？

**做了什么：**
四层安全防护：认证层 → 数据权限层 → 工具权限层 → 审计日志层。

**关键动作：**
1. **认证层**：OAuth 2.0 SSO（飞书/企业微信），前端登录后所有请求携带 token
2. **数据权限层（ABAC）**：用户只能查自己负责的客户。管理员/分析师可以跨区域查询。在 `auth.py` 的 `PermissionService` 中实现
3. **工具权限层（PreToolUse Hook）**：Agent 每次调 MCP 工具前，Hook 实时校验——"这个用户有没有权限查这个客户？"。`crm_data_access_control` 在工具调用前拦截，未授权直接返回 `allowed: false`
4. **审计日志层**：所有工具调用、参数、结果全量记录（生产环境接入 ELK）
5. Claude Agent SDK 的 `disallowed_tools` 配置阻止危险命令（`rm -rf`、`sudo`）
6. 还考虑了"明确拒绝 vs 静默过滤"的设计权衡——CRM 场景选明确拒绝，让销售知道"我看不到是因为没权限"从而主动申请

**结果如何：**
四层防护形成了纵深防御。PreToolUse Hook 是最后一道闸——即使 Agent 被 Prompt 注入诱导去查不该查的数据，Hook 也会在工具执行前拦截。

**一句话：** 不是"相信 Agent 不会越权"，而是"Agent 每次动手前都有人查证件"。

---

## Q6: Agent 调错工具怎么办？比如查了无关客户或用了错误的知识库查询？

**做了什么：**
通过多层机制降低错误率和提供容错：系统提示词约束、工具描述精确化、Agent Loop 自主纠错、`max_turns` 限制防止死循环。

**关键动作：**
1. **工具描述加入反例提示**：`search_customers` 的描述写明了 "当你需要查找/列出/筛选客户时使用此工具（而非获取单个客户详情）"，减少了模型选错工具的概率
2. **System Prompt 约束**："用户问客户情况 → 先调 get_customer_detail 获取真实数据，不要凭记忆编"
3. **Agent Loop 自主纠错**：Trace 面板显示 Agent 发现知识库查不到数据时，会换关键词重试——"The knowledge base doesn't have specific fill rate data. Let me search more broadly..."
4. **`max_turns=10`** 限制单次对话最多 10 轮工具调用，防止死循环
5. **知识库返回"未找到"时不报错，而是给通用建议**，让 Agent 优雅降级

**结果如何：**
实测中 Agent 展现了自适应行为：第一次搜索关键词不匹配 → 换更宽泛的关键词 → 还是没找到 → 诚实告诉用户"当前知识库缺少填充率和 eCPM 的具体数据，以下是公式和行业基准作为替代"。没有编造数据，没有死循环。

**一句话：** Agent 不是完美的，但它是诚实的——找不到就承认，而不是编。

---

## Q7: 国产模型（DeepSeek/Kimi/GLM）怎么接的？兼容性有什么坑？

**做了什么：**
通过 `ANTHROPIC_BASE_URL` 切换模型端点，建立模型兼容性注册表管理各厂商的行为差异。

**关键动作：**
1. DeepSeek V4 Pro 主力（日常对话 + 分析策略）、Kimi K2.6 备用（深度推理）、GLM-4.5（简单任务）
2. 发现并处理 Kimi 的 Anthropic 端点 4 个已知差异（GitHub issue #129 确认）：
   - temperature 会被内部缩放（实际 = 传入 × 0.6）
   - document 类型 content block 返回 400
   - thinking 在多轮工具调用中可能返回 400
   - 不支持 prompt caching
3. 创建 `model_compat.py` 注册表集中管理这些差异：`disable_thinking_default=True`（Kimi）、`temperature_scale=0.6` 等
4. 2026-07-24 及时更新 `deepseek-chat` → `deepseek-v4-pro`（旧名已弃用仅 3 天）
5. 按任务类型路由模型：简单查数 → deepseek-v4-flash（便宜），策略分析 → deepseek-v4-pro，深度调研 → kimi-k2.6

**结果如何：**
同一套代码支持 5 个国产模型（DeepSeek/Kimi/GLM/Qwen/豆包），改环境变量即可切换。兼容性差异全部配置化，新增模型只需在 `ModelCompatConfig` 中添加一条。

**一句话：** 不是"接了一个模型"，而是"模型无关的 Agent 框架"——任一国产模型 Anthropic 格式端点，改 URL 即用。

---

## Q8: 冷启动 30 秒怎么办？你怎么处理用户体验？

**做了什么：**
Render 免费版闲置 15 分钟后休眠，首次请求需 30-60 秒冷启动。通过前端提示 + 流式输出 + Trace 面板让用户感知到系统在工作而非卡死。

**关键动作：**
1. **Trace 面板实时反馈**：连接建立后立即显示"Agent 启动中... (Render冷启动需30-60秒)"→ thinking 文本 → tool_call 事件 → 流式文本 → 完成
2. **流式输出（SSE）**：文本逐字显示，不是等全部生成完才展示
3. **Agent 状态指示灯**：绿色脉冲 = 就绪，橙色脉冲 = 工作中
4. 后续优化方案：用 Render Cron Job 每 10 分钟 ping 一次 health endpoint 保持热启动

**结果如何：**
虽然冷启动时间长，但用户能看到 Agent 确实在工作——thinking 在流、工具在调、文本在出。比"干等 30 秒然后弹出完整结果"的体验好得多。热启动后响应时间 < 5 秒。

**一句话：** 等 30 秒不可怕，可怕的是不知道系统在干嘛。Trace 面板解决了这个问题。

---

## Q9: 你这套架构的可观测性/可调试性怎么样？

**做了什么：**
从 Agent SDK 的 `include_partial_messages` 捕获完整的 Agent 工作流（thinking/tool_call/text_delta），通过 SSE 实时推送到前端 Trace 面板。

**关键动作：**
1. **Agent Trace 面板**：实时显示每一轮 Agent 的 thinking 过程 + 调用了什么工具 + 输出文本
2. **health endpoint 增加调试信息**：`sdk_ready`、`claude_path`、`claude_version`、`node_version`——一键定位环境问题
3. **stderr 捕获**：ClaudeAgentOptions 的 `stderr` 回调捕获 CLI 进程的错误输出
4. **Token 用量统计**：每次对话结束后显示 input/output tokens
5. 前后端分离部署（Vercel + Render），各自独立日志，可通过 Vercel Analytics + Render Logs 分别排查

**结果如何：**
部署过程中遇到 Claude CLI "拒绝 root 用户用 bypassPermissions" 的错误——通过 stderr 捕获，3 分钟内定位到根因（`--dangerously-skip-permissions cannot be used with root/sudo privileges`），切到非 root 用户 `USER node` 修复。没有 Trace 面板和 stderr 捕获的话，这个 bug 至少要排查 2 小时。

**一句话：** Agent 不是黑盒——每一步 thinking、每个 tool_call、每个 token 都可见、可追溯、可审计。

---

## Q10: 如果给你更多时间，你会怎么改进？

**做了什么：**
当前已完成全链路（Vercel 前端 + Render 后端 + Claude Agent SDK + 4 个 MCP Server + 6 个 Skill + 真实 Agent Loop），但作为生产系统还有优化空间。

**关键改进方向：**

| 优先级 | 改进项 | 要解决什么问题 |
|--------|--------|--------------|
| P0 | **Memory 持久化与主动注入** | 当前 Agent 不记得上一轮对话。需要把 session_id 对应的对话历史 + 用户偏好存入 Milvus，每次对话前自动注入相关记忆到 system prompt |
| P0 | **接入真实广告投放 API** | 当前是 Mock 数据。需要对接巨量引擎/千川的 Open API，让 Agent 能查真实消耗、ROI、CTR 数据 |
| P1 | **知识库 RAG 接入真实文档** | 当前 KB 是手写的 20 条。需要爬取/导入广告帮助中心、政策文档、行业报告，用 Milvus 做语义检索 |
| P1 | **Session 存储迁移 Redis** | 当前的 `session_store.py` 已支持 Redis，但 `sendViaAgentAPI` 里的前端对话历史还没持久化——多轮对话上下文会丢失 |
| P2 | **Render 冷启动优化** | 用 Cron Job 每 10 分钟 warm up，或升级到 Render Starter（$7/月，无冷启动） |
| P2 | **多模态支持** | 当前只处理文本。广告场景需要支持图片素材分析（合规检测、CTR 预测）、视频素材审核 |
| P3 | **A/B 测试框架** | 对比不同 System Prompt、不同模型、不同 Skill 组合的效果差异 |

**结果如何（如果能完成）：**
P0 做完就能作为内部 MVP 灰度上线；P1 做完能覆盖 80% 的广告运营日常场景；P2 做完是生产级 SaaS。

**一句话：** 当前版本证明了"Agent 架构能跑通"，下一步是"让 Agent 跑在生产环境里"。

---

## 附：30 秒电梯演讲

> 我做的是**广告 AI 策略 Agent 工作台**——基于 Claude Agent SDK，对接 DeepSeek V4 Pro，跑在 Vercel + Render 上。
>
> 和市面上所有 AI CRM 产品的本质区别是：**我没有预设用户的交互路径**。Agent 手里有 Bash（逃生舱），脑子里有 Skill（领域知识），按需调用 MCP 工具。遇到竞品需要等产品排期三个月的需求，我的 Agent 现场写段 Python 就解决了。
>
> 目前全链路跑通——Agent 能自主调用工具查客户数据、对比行业基准、生成分析报告、写文件到磁盘。Trace 面板实时展示 Agent 的每一步 thinking 和 tool_call。支持 DeepSeek/Kimi/GLM 全部国产模型。
