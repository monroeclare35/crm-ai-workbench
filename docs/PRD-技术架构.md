# CRM AI 智能工作台 — PRD + 技术架构文档

> **版本**: v1.0  
> **日期**: 2026-07-27  
> **核心原则**: One Smart Agent, Infinite Capabilities — 用最灵活的 Agent 大脑，按需调用工具、加载技能，彻底告别硬编码工作流。

---

## 目录

- [Part 1: 产品需求文档 (PRD)](#part-1-产品需求文档-prd)
  - [1.1 产品愿景](#11-产品愿景)
  - [1.2 目标用户与角色](#12-目标用户与角色)
  - [1.3 核心场景与用户故事](#13-核心场景与用户故事)
  - [1.4 功能需求全景](#14-功能需求全景)
  - [1.5 成功指标](#15-成功指标)
- [Part 2: 技术架构文档](#part-2-技术架构文档)
  - [2.1 架构设计哲学](#21-架构设计哲学)
  - [2.2 系统全景架构](#22-系统全景架构)
  - [2.3 核心 Agent 引擎：Claude Agent SDK](#23-核心-agent-引擎claude-agent-sdk)
  - [2.4 MCP 工具体系设计](#24-mcp-工具体系设计)
  - [2.5 Skill 技能体系设计](#25-skill-技能体系设计)
  - [2.6 Memory 记忆体系设计](#26-memory-记忆体系设计)
  - [2.7 模型层：国产模型接入方案](#27-模型层国产模型接入方案)
  - [2.8 安全与权限架构](#28-安全与权限架构)
  - [2.9 部署架构](#29-部署架构)
  - [2.10 关键代码示例](#210-关键代码示例)

---

# Part 1: 产品需求文档 (PRD)

## 1.1 产品愿景

CRM AI 智能工作台是面向字节跳动商业化内部**销售、运营、管理**等角色打造的 **AI Native 智能工作台**。

**核心理念**：用大模型重新定义用户使用 CRM、获取知识、调用数据和服务客户的方式。让 AI 从"能回答问题"走向"能完成任务、辅助决策、沉淀经验"。

当前商业化业务中，客户数据、广告知识、营销策略和任务流程分散在不同系统和团队经验中。用户需要：
- 跨多个系统查询信息
- 手动整理数据
- 依赖个人经验做判断

CRM AI 工作台将这些能力重新组织，通过**自然语言交互、智能任务编排、Agent/Skill 调用和 Memory 沉淀**，为用户提供从"问题理解 → 数据查询 → 策略生成 → 行动建议"的端到端智能服务。

## 1.2 目标用户与角色

| 角色 | 核心诉求 | 典型场景 |
|------|---------|---------|
| **销售 (Sales)** | 快速了解客户、准备拜访、处理日常事务 | "帮我查一下XX客户最近的投放情况和消耗趋势" |
| **运营 (Operations)** | 监控客户健康度、发现问题客户、执行运营动作 | "帮我找出近7天消耗下降超过30%的客户，并生成告警" |
| **销售管理者 (Sales Manager)** | 团队业绩追踪、客户分配、策略指导 | "华东区本周新签客户数是多少？对比上周如何？" |
| **代理商/服务商** | 客户服务支持、问题排查、知识获取 | "XX行业的广告投放最佳实践是什么？" |
| **数据分析师 (Analyst)** | 深度数据探索、多维分析、报告生成 | "分析Q3各行业客户的生命周期价值" |

## 1.3 核心场景与用户故事

### 场景1：销售晨间准备

> **作为**一名销售，**我希望**每天早上到岗时，AI自动为我推送当日重点客户、待办事项和跟进建议，**以便**我高效规划一天的工作。

- AI 主动推送："早上好！你今天有3个待跟进客户，其中XX客户消耗近7天下降25%，建议优先联系。"
- 用户追问："帮我生成针对XX客户的拜访准备材料，包括客户近况、投放分析和沟通建议。"

### 场景2：客户数据洞察（自然语言查数）

> **作为**一名运营，**我希望**用自然语言直接查询客户数据，**而无需**在多个系统间切换、写SQL或做Excel。

- 用户："帮我查一下华东区教育行业、近30天消耗超过50万的客户，按消耗降序排列。"
- AI 实时查询 CRM 数据，返回结构化结果 + 一句话摘要。

### 场景3：广告知识即问即答

> **作为**一名代理商，**我希望**快速获取广告投放的政策规则、最佳实践和问题解决方案，**而无需**翻文档或问人。

- 用户："巨量千川的oCPM出价策略是什么？什么场景下用？"
- AI 从广告知识库检索，给出精炼答案 + 引用来源。

### 场景4：智能策略生成

> **作为**一名销售，**我希望**AI能根据客户画像和历史数据，为我生成个性化的营销策略建议。

- 用户："XX客户是做电商的，最近投流ROI在下降，帮我分析原因并给出优化建议。"
- AI 综合客户投放数据、行业benchmark、知识库，生成多维度策略建议。

### 场景5：任务自动化

> **作为**一名运营，**我希望**AI能帮我自动完成一些例行任务，比如批量生成客户周报。

- 用户："帮我生成本周华东区TOP 20客户的运营周报，包含消耗趋势、ROI变化和优化建议。"
- AI 编排多步操作：查数据 → 分析 → 生成报告 → 发送/保存。

### 场景6：Deep Research 深度调研

> **作为**一名销售管理者，**我希望**AI能对某个行业/客户群体做深度调研，生成完整的分析报告。

- 用户："帮我做一个关于'教育行业2026年数字广告投放趋势'的深度调研报告。"
- AI 启动 Deep Research 模式，多源搜索、交叉验证、生成结构化报告。

## 1.4 功能需求全景

```
┌────────────────────────────────────────────────────────────────────┐
│                    CRM AI 智能工作台 功能地图                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  智能对话     │  │  数据查询     │  │  知识问答     │             │
│  │  (Chat)      │  │  (Data Q&A)  │  │  (Knowledge) │             │
│  │              │  │              │  │              │             │
│  │ · 多轮对话   │  │ · NL2SQL     │  │ · 广告政策   │             │
│  │ · 上下文理解 │  │ · 多维分析   │  │ · 投放策略   │             │
│  │ · 意图识别   │  │ · 图表生成   │  │ · 行业洞察   │             │
│  │ · 追问澄清   │  │ · 数据导出   │  │ · 案例库     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  策略生成     │  │  任务自动化   │  │  智能报告     │             │
│  │  (Strategy)  │  │  (Automation)│  │  (Report)    │             │
│  │              │  │              │  │              │             │
│  │ · 投放优化   │  │ · 定时任务   │  │ · 客户报告   │             │
│  │ · 拓客建议   │  │ · 批量操作   │  │ · 团队报告   │             │
│  │ · 风险评估   │  │ · 工作流编排 │  │ · 行业报告   │             │
│  │ · 话术生成   │  │ · 结果追踪   │  │ · 自定义模板 │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  客户洞察     │  │  协同办公     │  │  Memory      │             │
│  │  (Insight)   │  │  (Collab)    │  │  (记忆)      │             │
│  │              │  │              │  │              │             │
│  │ · 360°画像   │  │ · 消息推送   │  │ · 用户偏好   │             │
│  │ · 异常检测   │  │ · 审批流转   │  │ · 会话记忆   │             │
│  │ · 流失预警   │  │ · 任务分配   │  │ · 经验沉淀   │             │
│  │ · 机会发现   │  │ · 日历集成   │  │ · 知识演化   │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────────────────────────────────────────┐             │
│  │           Deep Research（深度调研模式）           │             │
│  │  · 多源信息检索  · 交叉验证  · 结构化报告  · 引用追踪 │             │
│  └──────────────────────────────────────────────────┘             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 1.5 成功指标

| 指标维度 | 具体指标 | 目标值 |
|---------|---------|--------|
| **效率提升** | 销售日常信息查询时间减少 | > 60% |
| **决策质量** | AI 策略建议被采纳率 | > 40% |
| **用户体验** | 日活用户占比 | > 70% |
| **任务完成** | 端到端任务自动完成率 | > 50% |
| **知识覆盖** | 知识问答准确率 | > 90% |
| **数据时效** | 数据查询响应时间 | < 3s (P95) |
| **满意度** | NPS | > 50 |

---

# Part 2: 技术架构文档

## 2.1 架构设计哲学

### 核心信条：One Smart Agent, Infinite Capabilities

在架构设计之前，请先理解我们最核心的信念——

**看看 Claude Code 自己是什么架构？**

Claude Code 不是一个工作流引擎，不是一个 DAG 编排器，不是一个"先做A再做B然后判断C"的硬编码状态机。Claude Code 是一个**拥有强大原生能力（读写文件、执行命令、代码运行、Skill调用）的超级大脑**，它在每一轮对话中：
1. **感知**当前状态（文件内容、命令输出、错误信息）
2. **思考**下一步该做什么
3. **调用**最合适的工具
4. **观察**结果，然后**决定**继续还是结束

这个循环（Perception → Planning → Tool Execution → Reflection）才是 Agent 的本质。**不是工作流，而是大脑。**

### 我们的架构同样遵循这个哲学：

```
                    ┌──────────────────────┐
                    │    One Smart Agent   │
                    │   (Claude模型大脑)    │
                    │                      │
                    │  · 理解用户意图      │
                    │  · 自主规划步骤      │
                    │  · 按需调用工具      │
                    │  · 动态加载技能      │
                    │  · 观察结果迭代      │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  Native Tools │   │  MCP Tools   │   │    Skills    │
   │  (SDK内置)    │   │  (业务封装)   │   │  (领域知识)   │
   │              │   │              │   │              │
   │ · Bash       │   │ · CRM查询    │   │ · 客户分析   │
   │ · Edit/Write │   │ · 广告知识库  │   │ · 投放策略   │
   │ · Read/Grep  │   │ · 数据分析    │   │ · 报告模板   │
   │ · Code Exec  │   │ · 消息推送    │   │ · 销售流程   │
   │ · Skill      │   │ · 文档检索    │   │ · 运营SOP    │
   │ · Task       │   │ · ...更多     │   │ · ...更多    │
   └──────────────┘   └──────────────┘   └──────────────┘
```

**关键区别**：

| 传统做法 (LangChain/LangGraph) | 我们的做法 (Claude Agent SDK) |
|------------------------------|-------------------------------|
| 程序员预先定义工作流 DAG | Agent 大脑自主决定执行路径 |
| "先查A，再查B，然后调用C" 硬编码 | "我需要什么就调用什么" |
| 修改流程 = 改代码 + 重新部署 | 修改流程 = 更新 Skill 文字描述 |
| 边界情况靠 if-else 穷举 | 边界情况靠模型推理处理 |
| 工具调用链断裂难恢复 | Agent 观察错误后自主重试/换策略 |

### 什么时候用多个 Agent？

**只有一个场景：Deep Research。**

当需要多个独立视角对同一问题进行深度调研时（如：市场研究、竞品分析、行业报告），才会派生多个子 Agent 分头检索、交叉验证、最后汇总。其他所有场景——查数、分析、策略、报告、任务——**全部由一个 Agent 完成**。

子 Agent 的定义方式在 Claude Agent SDK 中通过 `agents` 字段配置，不代表主流程用多 Agent。

## 2.2 系统全景架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           前端交互层 (Frontend)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Web App      │  │ 飞书/企业微信 │  │ API / SDK    │                   │
│  │ (主工作台)    │  │ (消息触达)   │  │ (系统集成)    │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────────┐
│                     API Gateway + WebSocket                              │
│              (认证、鉴权、限流、路由、会话管理)                            │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────────┐
│                    Agent 编排层 (The Brain)                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │              Claude Agent SDK (核心引擎)                     │      │
│   │                                                             │      │
│   │   query(prompt, options=ClaudeAgentOptions(                 │      │
│   │     model="kimi-k2-turbo-preview",     # 国产模型           │      │
│   │     system_prompt=CRM_SYSTEM_PROMPT,   # 角色定义           │      │
│   │     mcp_servers={...},                 # MCP 工具           │      │
│   │     allowed_tools=[...],               # 工具权限           │      │
│   │     permission_mode="default",         # 权限模式           │      │
│   │     max_turns=15,                      # 最大推理轮次       │      │
│   │     setting_sources=["project"],       # 加载 .mcp.json    │      │
│   │   ))                                                        │      │
│   └─────────────────────────────────────────────────────────────┘      │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  Agent 内置原生能力 (SDK Native，100% 保留)                   │     │
│   │  · Bash — 执行Shell命令，无限灵活                             │     │
│   │  · Read — 读取文件内容                                       │     │
│   │  · Write — 写入文件                                          │     │
│   │  · Edit — 精确文本替换                                       │     │
│   │  · Glob — 文件模式匹配                                       │     │
│   │  · Grep — 内容搜索                                           │     │
│   │  · Skill — 加载调用技能                                      │     │
│   │  · Task — 子任务管理                                         │     │
│   │  · NotebookEdit — Notebook 编辑                              │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
│   ┌──────────────────────────┐  ┌──────────────────────────────┐       │
│   │  MCP 工具层 (业务封装)    │  │  Skill 技能层 (领域知识)      │       │
│   │                          │  │                              │       │
│   │  crm-data MCP Server     │  │  customer-analysis skill     │       │
│   │  ad-knowledge MCP Server │  │  ad-strategy skill           │       │
│   │  analytics MCP Server    │  │  sales-process skill         │       │
│   │  messaging MCP Server    │  │  report-generation skill     │       │
│   │  document MCP Server     │  │  data-query skill            │       │
│   │  workflow MCP Server     │  │  deep-research skill         │       │
│   └──────────────────────────┘  └──────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────────┐
│                      数据与服务层                                        │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ CRM DB   │ │ 广告数据  │ │ 知识库   │ │ 向量DB   │ │ 缓存层   │     │
│  │ (客户/   │ │ (投放/   │ │ (文档/   │ │ (Embed  │ │ (Redis)  │     │
│  │  合同/   │ │  消耗/   │ │  策略/   │ │  dings) │ │          │     │
│  │  商机)   │ │  报表)   │ │  案例)   │ │         │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.3 核心 Agent 引擎：Claude Agent SDK

### 为什么是 Claude Agent SDK？

| 对比维度 | LangChain/LangGraph | OpenAI API 裸调 | Dify/Coze | **Claude Agent SDK** |
|---------|-------------------|----------------|-----------|---------------------|
| Agent 能力 | 需自行实现 Agent Loop | 需自行实现工具调用循环 | 平台绑定 | **内置成熟 Agent Loop** |
| 原生工具 | 无，全靠手写 | 无 | 平台内置有限 | **Bash/Edit/Write/Read/Skill/Task 等** |
| 灵活性 | 中等（受限于链式抽象） | 高（但开发量大） | 低（平台约束） | **极高（SDK内置+自定义MCP）** |
| 工作流 | 硬编码 DAG | 自行编码 | 拖拽配置 | **Agent 大脑自主决策** |
| MCP 集成 | 需额外集成 | 需手写 | 有限支持 | **一等公民支持** |
| Skill 机制 | 无 | 无 | 有但不灵活 | **开放标准，渐进式加载** |
| 国产模型 | 需自行适配 | 需自行适配 | 平台锁定 | **原生 Anthropic 格式兼容** |

**结论**：Claude Agent SDK 是唯一一个既提供**成熟 Agent 大脑**、又保留**原生灵活能力（Bash/Edit/Skill）**、同时支持**按需扩展 MCP 工具**的框架。它就是 Claude Code 的内核，而 Claude Code 已经证明了自己是地表最强的 AI 编程工具——我们要做的，是把同样的架构思想搬到 CRM 场景。

### Agent 配置总览

```python
from claude_agent_sdk import (
    query, ClaudeAgentOptions, ResultMessage,
    tool, create_sdk_mcp_server,
    hook, HookEvent, HookMatcher,
)

# ============================================================
# 核心配置：一个 Agent 解决所有问题
# ============================================================

CRM_SYSTEM_PROMPT = """你是 CRM AI 智能工作台的智能助手，服务于字节跳动商业化团队的销售、运营和管理人员。

## 你的核心能力
1. **数据查询**：通过 MCP 工具查询 CRM 系统中的客户、合同、商机、消耗等数据
2. **知识检索**：检索广告投放政策、最佳实践、行业案例等知识
3. **策略分析**：基于数据和知识，为客户提供投放优化、拓客建议等策略
4. **报告生成**：自动生成客户报告、团队报告、行业分析报告
5. **任务执行**：完成文件操作、数据导出、消息推送等任务

## 工作原则
- 用户问什么，你就做什么。不需要的步骤不要做。
- 涉及数据查询时，先确认查询条件（时间范围、客户范围、指标），再执行查询。
- 涉及策略建议时，必须结合该客户的实际数据和行业知识，给出具体可落地的建议。
- 生成文件或报告后，告知用户保存位置或主动推送。
- 遇到不确定的情况，主动向用户澄清，不要猜测。

## 当前上下文
- 用户角色：{user_role}
- 用户部门：{user_department}
- 当前日期：{current_date}
"""

def create_crm_agent_options(
    model: str = "kimi-k2-turbo-preview",
    user_role: str = "sales",
    user_department: str = "华东区",
    session_id: str | None = None,
) -> ClaudeAgentOptions:
    """创建 CRM Agent 的完整配置"""

    # 系统提示词注入用户上下文
    system_prompt = CRM_SYSTEM_PROMPT.format(
        user_role=user_role,
        user_department=user_department,
        current_date="2026-07-27",
    )

    return ClaudeAgentOptions(
        # ========== 模型配置 ==========
        model=model,
        fallback_model="deepseek-chat",
        max_thinking_tokens=4000,

        # ========== 系统提示词 ==========
        system_prompt=system_prompt,

        # ========== 工具配置 ==========
        # 保留所有 SDK 原生工具 + 开放所有 MCP 工具
        allowed_tools=[
            # SDK 原生工具（保留，提供无限灵活性）
            "Bash",       # Shell 命令执行
            "Read",       # 文件读取
            "Write",      # 文件写入
            "Edit",       # 文本编辑
            "Glob",       # 文件匹配
            "Grep",       # 内容搜索
            "Skill",      # 技能调用
            "Task",       # 子任务管理

            # 业务 MCP 工具
            "mcp__crm_data__*",          # CRM 数据查询
            "mcp__ad_knowledge__*",      # 广告知识检索
            "mcp__analytics__*",         # 数据分析
            "mcp__messaging__*",         # 消息推送
            "mcp__document__*",          # 文档操作
            "mcp__workflow__*",          # 工作流操作
        ],

        # 禁止危险操作
        disallowed_tools=[
            "Bash(rm -rf *)",
            "Bash(sudo *)",
        ],

        # ========== MCP 服务器 ==========
        mcp_servers={
            # SDK 内嵌 MCP（高性能，零进程开销）
            "crm_data": create_crm_data_mcp_server(),
            "ad_knowledge": create_ad_knowledge_mcp_server(),
            "analytics": create_analytics_mcp_server(),
            "messaging": create_messaging_mcp_server(),
            "document": create_document_mcp_server(),
            "workflow": create_workflow_mcp_server(),

            # 外部 MCP 服务器（多语言支持）
            "playwright": {
                "command": "npx",
                "args": ["-y", "@playwright/mcp@latest"],
            },
        },

        # ========== 权限 ==========
        permission_mode="default",  # 生产环境必须 default
        # permission_mode="acceptEdits",  # 开发环境可用

        # ========== 限制 ==========
        max_turns=15,           # 防止无限循环
        max_budget_usd=1.0,     # 单次对话预算上限

        # ========== 环境 ==========
        cwd="/app/workspace",   # Agent 工作目录
        add_dirs=[              # 额外的上下文目录
            "/app/skills",      # Skill 定义目录
            "/app/knowledge",   # 本地知识库
        ],

        # ========== 会话管理 ==========
        resume=session_id,      # 恢复已有会话
        fork_session=False,

        # ========== 高级功能 ==========
        setting_sources=["project"],  # 加载项目级 .mcp.json
        enable_file_checkpointing=True,

        # ========== 钩子 ==========
        hooks={
            HookEvent.PRE_TOOL_USE: [
                HookMatcher(
                    matcher="Bash",
                    hooks=[audit_bash_command],
                ),
            ],
        },
    )
```

## 2.4 MCP 工具体系设计

MCP（Model Context Protocol）是 Agent 的"手"——让 Agent 能够与外部系统交互。

在我们的架构中，MCP 工具分为两大类：

### A. SDK 原生工具（保留，不封装，直接使用）

这些是 Claude Agent SDK 内置的工具，**已经具备强大的灵活性**：

| 原生工具 | 在 CRM 场景的用途 | 为什么必须保留？ |
|---------|------------------|----------------|
| **Bash** | 执行 Python 脚本做复杂数据处理；调用 curl 调试 API；运行 aws/gsutil 等命令行工具 | 无限灵活性——Agent 可以现场写脚本解决任何未预见的问题 |
| **Read** | 读取生成的报告、查看知识库文件 | 文件系统是 Agent 的"记忆外存" |
| **Write** | 将分析结果保存为 CSV/Excel/HTML 报告 | Agent 产出物的持久化 |
| **Edit** | 修改已有的报告模板、配置文件 | 精确修改能力 |
| **Glob** | 查找某个客户的所有报告文件 | 文件导航 |
| **Grep** | 在知识库中搜索关键词 | 高效内容检索 |
| **Skill** | 加载领域技能（见 2.5 节） | 技能系统的入口 |
| **Task** | 管理复杂多步任务 | 任务编排 |

**关键洞察**：有了 Bash，Agent 可以现场写 Python 脚本处理任何复杂数据格式，而不需要你为每种数据格式都封装一个 MCP 工具。这就是"聪明的 Agent 大脑 + 通用灵活工具"碾压"愚蠢的硬编码工作流"的核心原因。

### B. 业务 MCP 工具（按需封装）

只封装**那些 Bash 无法直接访问的外部系统**和**需要权限控制/审计的关键操作**：

#### B1. CRM 数据 MCP Server (`crm_data`)

```python
# mcp_servers/crm_data_mcp.py

from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations

# ---- 客户查询 ----
@tool(
    "search_customers",
    "搜索客户。支持按名称、行业、区域、客户等级、销售负责人等条件筛选。"
    "返回客户基本信息列表（ID、名称、行业、等级、负责人、近30天消耗）。",
    {
        "keyword": str,           # 搜索关键词
        "industry": str,          # 行业筛选（可选）
        "region": str,            # 区域筛选（可选）
        "level": str,             # 客户等级筛选（可选）
        "owner": str,             # 销售负责人筛选（可选）
        "limit": int,             # 返回数量限制，默认20
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def search_customers(args):
    """查询 CRM 客户数据"""
    # 实际实现：查询 CRM 数据库或 API
    results = await crm_db.query_customers(
        keyword=args.get("keyword"),
        industry=args.get("industry"),
        region=args.get("region"),
        level=args.get("level"),
        owner=args.get("owner"),
        limit=args.get("limit", 20),
    )
    return {
        "content": [{
            "type": "text",
            "text": json.dumps(results, ensure_ascii=False, indent=2),
        }]
    }

# ---- 客户详情 ----
@tool(
    "get_customer_detail",
    "获取单个客户的详细信息，包括：基本信息、合同情况、投放账户、"
    "近12个月消耗趋势、服务记录、关联商机等360°画像数据。",
    {
        "customer_id": str,       # 客户ID（必填）
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def get_customer_detail(args):
    """获取客户360°画像"""
    detail = await crm_db.get_customer_full_profile(args["customer_id"])
    return {
        "content": [{"type": "text", "text": json.dumps(detail, ensure_ascii=False, indent=2)}]
    }

# ---- 消耗数据查询 ----
@tool(
    "query_consumption",
    "查询客户/账户的广告消耗数据。支持多维度聚合（按时间、行业、区域、产品线）。"
    "支持同比/环比计算。",
    {
        "customer_ids": list[str],  # 客户ID列表（可选）
        "start_date": str,          # 开始日期 YYYY-MM-DD
        "end_date": str,            # 结束日期 YYYY-MM-DD
        "group_by": str,            # 聚合维度：day/week/month/industry/region/product
        "metrics": list[str],       # 指标：cost/impression/click/ctr/cvr/roi
        "compare": str,             # 对比方式：yoy(同比)/mom(环比)/none
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def query_consumption(args):
    """查询广告消耗数据"""
    data = await analytics_engine.query(
        customer_ids=args.get("customer_ids"),
        start_date=args["start_date"],
        end_date=args["end_date"],
        group_by=args.get("group_by", "day"),
        metrics=args.get("metrics", ["cost", "roi"]),
        compare=args.get("compare", "none"),
    )
    return {
        "content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False, indent=2)}]
    }

# ---- 创建 CRM 数据 MCP Server ----
def create_crm_data_mcp_server():
    return create_sdk_mcp_server(
        name="crm_data",
        version="1.0.0",
        tools=[
            search_customers,
            get_customer_detail,
            query_consumption,
        ],
    )
```

#### B2. 广告知识库 MCP Server (`ad_knowledge`)

```python
# mcp_servers/ad_knowledge_mcp.py

@tool(
    "search_ad_knowledge",
    "检索广告投放相关知识。覆盖：广告政策规则、投放策略最佳实践、"
    "行业案例、产品文档(OEM/千川/搜索/穿山甲等)、FAQ。"
    "支持语义搜索和关键词搜索。",
    {
        "query": str,             # 搜索问题或关键词
        "category": str,          # 知识分类：policy/strategy/case/product/faq
        "product": str,           # 产品线：oem/qianchuan/search/pangle
        "top_k": int,             # 返回最相关的结果数，默认5
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def search_ad_knowledge(args):
    """语义搜索广告知识库（RAG）"""
    results = await knowledge_base.search(
        query=args["query"],
        category=args.get("category"),
        product=args.get("product"),
        top_k=args.get("top_k", 5),
    )
    # 格式化返回结果，包含标题、内容摘要、来源、相关度
    formatted = []
    for r in results:
        formatted.append({
            "title": r["title"],
            "content": r["content"][:800],  # 截断长文本
            "source": r["source"],
            "relevance": r["score"],
        })
    return {
        "content": [{"type": "text", "text": json.dumps(formatted, ensure_ascii=False, indent=2)}]
    }

@tool(
    "get_knowledge_detail",
    "获取某条知识的完整内容。当 search_ad_knowledge 返回的结果不够详细时使用。",
    {
        "doc_id": str,            # 知识文档ID
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def get_knowledge_detail(args):
    """获取知识详情"""
    doc = await knowledge_base.get_document(args["doc_id"])
    return {
        "content": [{"type": "text", "text": doc["full_content"]}]
    }

def create_ad_knowledge_mcp_server():
    return create_sdk_mcp_server(
        name="ad_knowledge",
        version="1.0.0",
        tools=[search_ad_knowledge, get_knowledge_detail],
    )
```

#### B3. 数据分析 MCP Server (`analytics`)

```python
# mcp_servers/analytics_mcp.py

@tool(
    "run_analysis",
    "执行自定义数据分析。支持：趋势分析、异常检测、客户分层(RFM)、"
    "同期群分析、漏斗分析等。结果可以返回JSON数据或生成图表。",
    {
        "analysis_type": str,     # 分析类型：trend/anomaly/rfm/cohort/funnel
        "params": dict,           # 分析参数（因类型而异）
        "output_format": str,     # 输出格式：json/chart/both
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def run_analysis(args):
    """执行数据分析"""
    result = await analytics_engine.run(
        analysis_type=args["analysis_type"],
        params=args["params"],
        output_format=args.get("output_format", "json"),
    )
    return {
        "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]
    }

def create_analytics_mcp_server():
    return create_sdk_mcp_server(
        name="analytics",
        version="1.0.0",
        tools=[run_analysis],
    )
```

#### B4. 消息推送 MCP Server (`messaging`)

```python
# mcp_servers/messaging_mcp.py

@tool(
    "send_message",
    "向指定用户或群组发送消息。支持飞书、企业微信。"
    "可用于推送报告、告警、提醒等。这是一项有副作用（destructive）的操作，请确认后执行。",
    {
        "channel": str,           # 渠道：feishu/wecom
        "recipient": str,         # 接收人ID或群ID
        "content": str,           # 消息内容（支持 Markdown）
        "msg_type": str,          # 消息类型：text/markdown/card/file
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def send_message(args):
    """发送消息"""
    result = await messaging_service.send(
        channel=args["channel"],
        recipient=args["recipient"],
        content=args["content"],
        msg_type=args.get("msg_type", "markdown"),
    )
    return {
        "content": [{"type": "text", "text": f"消息发送成功: {result['msg_id']}"}]
    }

def create_messaging_mcp_server():
    return create_sdk_mcp_server(
        name="messaging",
        version="1.0.0",
        tools=[send_message],
    )
```

#### B5. 工作流 MCP Server (`workflow`)

```python
# mcp_servers/workflow_mcp.py

@tool(
    "create_task",
    "在 CRM 系统中创建任务/待办。可用于为自己或他人创建跟进提醒、会议安排等。",
    {
        "title": str,             # 任务标题
        "description": str,       # 任务描述
        "assignee": str,          # 负责人ID
        "customer_id": str,       # 关联客户ID（可选）
        "due_date": str,          # 截止日期 YYYY-MM-DD（可选）
        "priority": str,          # 优先级：high/medium/low
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def create_task(args):
    """创建 CRM 任务"""
    task = await workflow_service.create_task(
        title=args["title"],
        description=args.get("description", ""),
        assignee=args["assignee"],
        customer_id=args.get("customer_id"),
        due_date=args.get("due_date"),
        priority=args.get("priority", "medium"),
    )
    return {
        "content": [{"type": "text", "text": f"任务创建成功: {task['id']}"}]
    }

def create_workflow_mcp_server():
    return create_sdk_mcp_server(
        name="workflow",
        version="1.0.0",
        tools=[create_task],
    )
```

### MCP 工具全景图

```
MCP 工具体系
├── SDK 原生工具 (保留所有，Agent 直接调用)
│   ├── Bash        ← "万能扳手"，执行任意脚本/命令
│   ├── Read        ← 读文件
│   ├── Write       ← 写文件（生成报告、保存结果）
│   ├── Edit        ← 精确编辑
│   ├── Glob/Grep   ← 文件搜索
│   ├── Skill       ← 加载技能（技能系统入口）
│   └── Task        ← 子任务管理
│
├── 业务 MCP 工具 (SDK 内嵌，封装外部系统)
│   ├── crm_data MCP Server
│   │   ├── search_customers     (只读)
│   │   ├── get_customer_detail  (只读)
│   │   └── query_consumption    (只读)
│   │
│   ├── ad_knowledge MCP Server
│   │   ├── search_ad_knowledge  (只读)
│   │   └── get_knowledge_detail (只读)
│   │
│   ├── analytics MCP Server
│   │   └── run_analysis         (只读)
│   │
│   ├── messaging MCP Server
│   │   └── send_message         (有副作用)
│   │
│   ├── document MCP Server
│   │   ├── search_documents     (只读)
│   │   └── create_document      (有副作用)
│   │
│   └── workflow MCP Server
│       ├── create_task          (有副作用)
│       └── update_task          (有副作用)
│
└── 外部 MCP 工具 (进程隔离，可选)
    └── playwright MCP Server     ← 浏览器自动化（截图、爬取）
```

**封装原则**：
1. **Bash 能解决的，不封装 MCP 工具**（Agent 自己写 Python 脚本处理）
2. **需要访问外部 API/数据库的，封装为 MCP 工具**（提供认证、限流、审计）
3. **有副作用的操作，标注 `destructiveHint=True`**（Agent 会更谨慎）
4. **只读操作标注 `readOnlyHint=True`**（Agent 可以并行调用）

## 2.5 Skill 技能体系设计

Skill 是 Agent 的"脑内知识"——告诉 Agent **如何思考、如何组合工具、如何处理某类任务**。

Skill 与 MCP 工具的关系：**MCP 提供"能做什么"（能力），Skill 提供"怎么做"（方法论）。**

### Skill 目录结构

```
skills/
├── customer-analysis/
│   ├── SKILL.md              # 技能定义（核心）
│   ├── references/
│   │   ├── industry-taxonomy.md    # 行业分类体系
│   │   ├── customer-health-score.md # 客户健康度评分模型
│   │   └── churn-signals.md       # 流失信号清单
│   └── scripts/
│       └── cohort_analysis.py     # 同期群分析脚本（被 Bash 调用）
│
├── ad-strategy/
│   ├── SKILL.md
│   ├── references/
│   │   ├── bidding-strategies.md  # 出价策略对比
│   │   ├── creative-best-practices.md # 创意最佳实践
│   │   └── industry-benchmarks.md # 行业Benchmark
│   └── scripts/
│       └── roi_calculator.py
│
├── sales-process/
│   ├── SKILL.md
│   ├── references/
│   │   ├── sales-stages.md        # 销售阶段定义
│   │   ├── meeting-prep-checklist.md # 拜访准备清单
│   │   └── objection-handling.md  # 异议处理
│   └── scripts/
│       └── meeting_brief_gen.py
│
├── report-generation/
│   ├── SKILL.md
│   ├── references/
│   │   ├── report-templates.md    # 报告模板库
│   │   └── chart-standards.md     # 图表标准
│   └── assets/
│       ├── weekly-report-template.html
│       └── customer-report-template.html
│
├── data-query/
│   ├── SKILL.md
│   ├── references/
│   │   ├── data-model.md          # CRM 数据模型
│   │   ├── metric-definitions.md  # 指标口径定义
│   │   └── query-patterns.md      # 常见查询模式
│   └── scripts/
│       └── data_quality_check.py
│
└── deep-research/
    ├── SKILL.md
    └── references/
        ├── research-methodology.md
        └── source-evaluation.md
```

### Skill 定义示例

#### 示例1：客户分析 Skill (`customer-analysis/SKILL.md`)

```markdown
---
name: customer-analysis
description: >
  客户分析技能。当用户需要了解客户情况、分析客户数据、评估客户健康度、
  准备客户拜访材料时触发。覆盖：客户360°画像解读、消耗趋势分析、
  健康度评分、流失风险识别、行业对比分析。
---

# 客户分析技能 (Customer Analysis)

## 触发场景
- 用户询问某个/某些客户的情况："XX客户最近怎么样？""帮我看看XX客户"
- 用户要求分析客户数据："分析一下XX客户的消耗趋势"
- 用户准备拜访："帮我准备XX客户的拜访材料"
- 用户关心客户健康："哪些客户最近有问题？""有没有流失风险的客户？"

## 分析方法论

### 1. 客户画像解读
当用户询问某个客户时，按以下框架组织信息：
- **基础信息**：公司名、行业、规模、区域、客户等级
- **合作概况**：首次合作时间、合同状态、服务团队
- **投放概况**：主要投放产品、主力账户、近30天消耗
- **趋势判断**：消耗是上升/稳定/下降？ROI 是改善/恶化？
- **近期事件**：最近的服务记录、投诉、合同变更

### 2. 消耗趋势分析
当分析客户的消耗变化时：
1. 先拉取近12个月的月度消耗数据（如有）
2. 计算同比和环比变化
3. 识别拐点：哪个月开始变化？那个月发生了什么？
4. 结合行业数据和客户自身业务周期判断是否正常
5. 如果不正常，给出具体的影响因素假设

### 3. 健康度评估
使用客户健康度评分模型（参考 references/customer-health-score.md）：
- 消耗稳定性 (25%)
- ROI 水平 (25%)
- 回款及时性 (15%)
- 服务满意度 (15%)
- 产品使用广度 (10%)
- 合同续签状态 (10%)
综合给出健康/关注/风险的评级。

### 4. 流失预警
检查客户是否存在以下流失信号（参考 references/churn-signals.md）：
- 消耗连续2个月下降超过30%
- ROI 持续低于行业平均水平
- 近30天无新增投放计划
- 服务工单增加或满意度下降
- 关键对接人变更
如果命中2个以上信号，标记为"流失风险"并建议干预。

## 输出规范
- 使用结构化格式呈现分析结果（分节、分点）
- 关键数字要加粗或突出
- 策略建议必须具体可操作，不能泛泛而谈
- 如有异常，必须给出"可能原因"+"建议动作"
```

#### 示例2：广告策略 Skill (`ad-strategy/SKILL.md`)

```markdown
---
name: ad-strategy
description: >
  广告投放策略技能。当用户询问如何优化广告投放、选择出价策略、
  提升ROI、制定投放方案时触发。
---

# 广告投放策略技能 (Ad Strategy)

## 触发场景
- 用户询问投放建议："怎么提升XX客户的ROI？"
- 用户要求制定方案："帮我给XX客户出一个投放方案"
- 用户询问策略选择："oCPM和oCPC应该怎么选？"

## 分析方法论

### 1. 投放诊断流程
收到策略请求时，按以下顺序执行：
1. **获取客户数据** → 调用 `mcp__crm_data__get_customer_detail`
2. **获取消耗数据** → 调用 `mcp__crm_data__query_consumption`（近90天，按天）
3. **获取行业基准** → 调用 `mcp__ad_knowledge__search_ad_knowledge` 查询行业Benchmark
4. **对比诊断** → 将客户数据与行业基准对比，找出差距最大的环节
5. **生成建议** → 针对瓶颈环节给出具体优化建议

### 2. 出价策略选择
- **oCPM**：适合以曝光/转化为目标的场景，需要充足转化数据
- **oCPC**：适合以点击/引流为目标的场景，对转化数据要求较低
- **自动出价**：适合缺乏优化人力的中小客户
- **规则出价**：适合对成本有严格管控的大型客户
详见 references/bidding-strategies.md

### 3. 创意优化建议
（参考 references/creative-best-practices.md）
从以下维度评估：
- 素材新鲜度：近7天是否有新素材上线？
- CTR 健康度：是否高于行业平均水平？
- 素材多样性：视频/图片/文案种类是否充足？
- 落地页体验：加载速度、转化路径是否优化？

## 关键原则
- **以数据说话**：所有建议必须有数据支撑，不要凭经验瞎猜
- **分优先级**：将建议按"预期效果 × 实施难度"排序
- **给出预期**：每条建议给出预期效果范围（如"预计可提升ROI 5-15%"）
- **可落地**：每条建议必须是销售可以跟客户直接沟通的内容
```

#### 示例3：Deep Research Skill (`deep-research/SKILL.md`)

```markdown
---
name: deep-research
description: >
  深度调研技能。当用户需要进行行业研究、竞品分析、市场调研时触发。
  这是唯一会派生多个子 Agent 并行工作的场景。
---

# 深度调研技能 (Deep Research)

## 触发场景
- "帮我研究一下XX行业的广告投放趋势"
- "做一个XX竞品的分析报告"
- "深度调研XX市场的机会"

## 执行流程

### 阶段1：任务分解
将用户的研究问题分解为 3-5 个独立的研究子方向。
例如"教育行业2026年数字广告投放趋势"可分解为：
- 子方向1：教育行业广告市场规模与增长
- 子方向2：主要投放平台与产品变化
- 子方向3：政策与合规动态
- 子方向4：头部客户案例与ROI表现
- 子方向5：未来预测与机会

### 阶段2：并行调研（唯一使用多 Agent 的场景）
为每个子方向派生独立的子 Agent：
- 每个子 Agent 使用 `search_ad_knowledge` + `WebSearch` 获取信息
- 每个子 Agent 独立完成自己的调研方向
- 所有子 Agent 并行运行

### 阶段3：交叉验证
对子 Agent 返回的结果：
- 检查不同来源的信息是否一致
- 标注有矛盾的地方
- 对有疑问的信息做补充检索

### 阶段4：报告合成
将各子方向的调研结果合成为结构化报告：
- 执行摘要 (Executive Summary)
- 分方向详细分析
- 关键发现与洞察
- 建议与行动项
- 信息来源与引用

## 输出规范
- Markdown 格式，含目录
- 每个数据点标注来源
- 关键发现使用醒目的 Callout
- 建议部分包含优先级和可行性评估
```

### Skill 的加载机制

Skill 通过 Claude Agent SDK 的 `add_dirs` 配置自动被发现和加载：

```python
options = ClaudeAgentOptions(
    # Skill 目录会被 SDK 自动扫描
    add_dirs=["/app/skills"],

    # 也可以通过 setting_sources 加载项目级 Skill 配置
    setting_sources=["project"],
)
```

SDK 会扫描 `add_dirs` 下每个子目录中的 `SKILL.md` 文件，提取其中的 YAML frontmatter（`name` 和 `description`）作为 Skill 元数据（~100 tokens），在 Agent 启动时加载。只有当 Agent 决定调用某个 Skill 时，完整的 `SKILL.md` 内容才会被注入上下文。

**渐进式加载的优势**：
- 即使有 20 个 Skill，启动时的上下文开销也只有 ~2000 tokens
- Agent 看到的是 Skill 的"目录"，按需深入
- 新增 Skill 只需要添加一个目录 + SKILL.md，无需改代码

## 2.6 Memory 记忆体系设计

Memory 是 Agent 的"经验"——让每次交互都比上一次更聪明。

### 三层 Memory 架构

```
┌─────────────────────────────────────────────┐
│              Memory 体系                     │
├─────────────────────────────────────────────┤
│                                             │
│  Layer 1: 会话记忆 (Session Memory)         │
│  ┌───────────────────────────────────────┐  │
│  │ · Claude Agent SDK 原生会话管理       │  │
│  │ · 通过 resume session_id 恢复         │  │
│  │ · 多轮对话上下文自动保持               │  │
│  │ · 存活周期：单次会话                   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Layer 2: 用户记忆 (User Memory)            │
│  ┌───────────────────────────────────────┐  │
│  │ · 用户偏好（喜欢的报告格式、常用指标） │  │
│  │ · 用户习惯（工作时间、关注客户）       │  │
│  │ · 用户反馈（"以后别用表格，用图表"）   │  │
│  │ · 存活周期：跨会话持久化               │  │
│  │ · 存储方式：向量DB + 结构化存储        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Layer 3: 组织记忆 (Organizational Memory)  │
│  ┌───────────────────────────────────────┐  │
│  │ · 团队最佳实践                         │  │
│  │ · 成功案例的模式总结                   │  │
│  │ · 常见问题的解决路径                   │  │
│  │ · 存活周期：持久化 + 定期更新          │  │
│  │ · 存储方式：向量DB + 人工审核          │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### Memory MCP 工具

```python
@tool(
    "remember",
    "将一条信息存入记忆。用于记住用户偏好、重要上下文、经验教训等。",
    {
        "content": str,           # 记忆内容
        "category": str,          # 分类：user_preference/user_feedback/lesson_learned/fact
        "tags": list[str],        # 标签
    },
    annotations=ToolAnnotations(destructiveHint=True),
)
async def remember(args):
    """存入记忆"""
    memory_id = await memory_store.add(
        content=args["content"],
        category=args["category"],
        tags=args.get("tags", []),
        user_id=current_user_id,
        timestamp=datetime.now().isoformat(),
    )
    return {"content": [{"type": "text", "text": f"已记住: {memory_id}"}]}

@tool(
    "recall",
    "从记忆中检索相关信息。根据语义相似度返回最相关的记忆。",
    {
        "query": str,             # 查询内容
        "category": str,          # 分类筛选（可选）
        "top_k": int,             # 返回条数，默认5
    },
    annotations=ToolAnnotations(readOnlyHint=True),
)
async def recall(args):
    """检索记忆"""
    memories = await memory_store.search(
        query=args["query"],
        category=args.get("category"),
        user_id=current_user_id,
        top_k=args.get("top_k", 5),
    )
    return {
        "content": [{"type": "text", "text": json.dumps(memories, ensure_ascii=False, indent=2)}]
    }
```

## 2.7 模型层：国产模型接入方案

Claude Agent SDK 底层基于 Anthropic Messages API。国内主流大模型厂商均已提供 **Anthropic 兼容格式的端点**，只需修改 `ANTHROPIC_BASE_URL` 即可无缝接入。

### 五大国产模型配置 (更新于 2026-07-27)

> ⚠️ `deepseek-chat` / `deepseek-reasoner` 已于 2026-07-24 弃用！必须使用 V4 系列。
> ⚠️ `kimi-k2-turbo-preview` 已停用！使用 `kimi-k2.6` 或 `kimi-k2.7-code`。

| 模型厂商 | ANTHROPIC_BASE_URL | 推荐模型 | 注意 |
|---------|-------------------|---------|------|
| **DeepSeek** | `https://api.deepseek.com/anthropic` | `deepseek-v4-pro` / `deepseek-v4-flash` | V4 Pro: 1.6T/49B active, 1M context, thinking可选 |
| **Kimi (Moonshot)** | `https://api.moonshot.ai/anthropic` | `kimi-k2.6` / `kimi-k2.7-code` | temperature×0.6, 多轮关thinking, 不支持caching |
| **GLM (智谱)** | `https://open.bigmodel.cn/api/anthropic` | `glm-4.5` / `glm-4.5-air` | 不支持 Anrhropic thinking |
| **Qwen (阿里百炼)** | `https://dashscope.aliyuncs.com/api/v2/apps/claude-code-proxy` | `qwen3-max` | 需通过百炼应用代理 |
| **火山引擎方舟** | `https://ark.cn-beijing.volces.com/api/coding` | `doubao-1.5-pro-256k` | 字节内部推荐 |

详细兼容性差异见 `app/model_compat.py` 中的 `MODEL_REGISTRY`。

### 多模型策略

```python
# 环境变量配置（最简方式）
# 生产环境通过 K8s ConfigMap / Secret 注入

import os

# 方案1：直接设置环境变量（Agent SDK 自动读取）
os.environ["ANTHROPIC_BASE_URL"] = "https://api.deepseek.com/anthropic"
os.environ["ANTHROPIC_AUTH_TOKEN"] = "sk-xxx"
os.environ["ANTHROPIC_MODEL"] = "deepseek-v4-pro"
os.environ["ANTHROPIC_SMALL_FAST_MODEL"] = "deepseek-v4-flash"

# 方案2：通过 model_compat 模块获取推荐模型（推荐）
from app.model_compat import get_recommended_model, get_model_config

model_id = get_recommended_model("analysis", prefer_provider="deepseek")
config = get_model_config(model_id)
# config.temperature_scale, config.supports_thinking, config.disable_thinking_default ...

# 方案3：在 ClaudeAgentOptions 中指定（最灵活）
options = ClaudeAgentOptions(
    model="deepseek-v4-pro",
    fallback_model="kimi-k2.6",  # 主模型不可用时的 fallback
    env={
        "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
        "ANTHROPIC_AUTH_TOKEN": os.environ["ANTHROPIC_AUTH_TOKEN"],
    },
)
```

### 模型路由策略

```
用户请求
    │
    ├── 简单查数 / FAQ ──────→ deepseek-v4-flash (快速、便宜)
    │
    ├── 客户分析 / 策略建议 ──→ deepseek-v4-pro (主力，全能)
    │
    ├── Deep Research / 复杂推理 → kimi-k2.6 (备用，推理强)
    │
    └── 代码生成 / 数据处理 ──→ deepseek-v4-pro (编码能力强)
```

> **注意**：DeepSeek V4 的 peak/off-peak 定价已于 2026年7月上线，北京时段 09:00-12:00 & 14:00-18:00 价格约 2×。生产环境需关注成本优化。

## 2.8 安全与权限架构

### 多层安全防护

```
┌─────────────────────────────────────────────┐
│              Security Layers                │
├─────────────────────────────────────────────┤
│                                             │
│  Layer 1: 用户认证                          │
│  └─ OAuth 2.0 / SSO (飞书/企业微信)        │
│                                             │
│  Layer 2: 数据权限 (ABAC)                   │
│  └─ 租户隔离 + 角色权限 + 字段级权限        │
│     + 数据行级权限（你只能看你自己的客户）  │
│                                             │
│  Layer 3: Agent 工具权限                     │
│  └─ allowed_tools / disallowed_tools        │
│     + permission_mode                       │
│     + PreToolUse hooks 动态鉴权              │
│                                             │
│  Layer 4: 操作审计                          │
│  └─ 所有工具调用记录 + 参数 + 结果          │
│     + 敏感操作审批流（send_message等）      │
│                                             │
│  Layer 5: 数据安全                          │
│  └─ Prompt 注入检测 + 数据脱敏              │
│     + PII 检测 + 输出过滤                  │
│                                             │
└─────────────────────────────────────────────┘
```

### PreToolUse Hook 示例

```python
@hook(HookEvent.PRE_TOOL_USE, matcher="mcp__crm_data__*")
async def crm_data_access_control(tool_name, tool_input, context):
    """在执行 CRM 数据查询前，校验用户是否有数据权限"""
    user = context["user"]

    # 获取工具参数中的客户 ID 或条件
    customer_ids = tool_input.get("customer_ids", [])
    region = tool_input.get("region")

    # 校验：销售只能查自己的客户
    if customer_ids:
        for cid in customer_ids:
            if not await permission_service.can_access_customer(user.id, cid):
                return {
                    "allowed": False,
                    "reason": f"你没有权限查看客户 {cid} 的数据",
                }

    # 校验：跨区域查询需要审批
    if region and region != user.department:
        if not user.has_permission("cross_region_access"):
            return {
                "allowed": False,
                "reason": f"你没有跨区域查询权限，你的区域是 {user.department}",
            }

    return {"allowed": True}

@hook(HookEvent.PRE_TOOL_USE, matcher="mcp__messaging__send_message")
async def messaging_approval(tool_name, tool_input, context):
    """发送消息前需要用户确认"""
    # SDK 的 permission_mode="default" 会自动弹出确认框
    # 这里做额外校验：批量发送需要审批
    recipients = tool_input.get("recipient", "")
    if "," in recipients or "all" in recipients.lower():
        return {
            "allowed": False,
            "reason": "批量发送消息需要走审批流程，请提交审批单。",
        }
    return {"allowed": True}
```

## 2.9 部署架构

```
┌────────────────────────────────────────────────────────────────┐
│                       Deployment Architecture                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Users (Browser / 飞书 / 企业微信)                             │
│         │                                                      │
│         ▼                                                      │
│  ┌─────────────────┐                                           │
│  │   API Gateway   │  (Kong / Nginx)                           │
│  │   + Auth + WAF  │                                           │
│  └────────┬────────┘                                           │
│           │                                                    │
│     ┌─────┴──────────────────────────┐                        │
│     │                                │                        │
│     ▼                                ▼                        │
│  ┌──────────────┐            ┌──────────────┐                 │
│  │  Chat Server │            │  Job Server  │                 │
│  │  (FastAPI)   │            │  (Async)     │                 │
│  │              │            │              │                 │
│  │ · 实时对话   │            │ · 定时任务   │                 │
│  │ · WebSocket  │            │ · 批量报告   │                 │
│  │ · Agent 管理 │            │ · Deep       │                 │
│  │              │            │   Research   │                 │
│  └──────┬───────┘            └──────┬───────┘                 │
│         │                           │                          │
│         │     ┌─────────────────────┘                          │
│         │     │                                                │
│         ▼     ▼                                                │
│  ┌──────────────────────────────────────┐                     │
│  │      Claude Agent SDK Runtime        │                     │
│  │                                      │                     │
│  │  · Agent 实例池 (连接池复用)         │                     │
│  │  · Session Manager (会话管理)        │                     │
│  │  · MCP Server Registry               │                     │
│  │  · Skill Loader                      │                     │
│  │  · Memory Store                      │                     │
│  └────────────────┬─────────────────────┘                     │
│                   │                                            │
│     ┌─────────────┼─────────────┐                             │
│     │             │             │                             │
│     ▼             ▼             ▼                             │
│  ┌────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ CRM DB │ │ Vector DB│ │  Redis   │                        │
│  │(TiDB/  │ │(Milvus/  │ │ (Cache/  │                        │
│  │ MySQL) │ │  ES)     │ │  Queue)  │                        │
│  └────────┘ └──────────┘ └──────────┘                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 关键组件说明

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| API Gateway | Kong / Nginx | 认证、限流、路由、WebSocket 支持 |
| Chat Server | Python FastAPI | 实时对话入口，管理 Agent 生命周期 |
| Job Server | Celery / Arq | 异步任务（定时报告、批量操作） |
| Agent Runtime | Claude Agent SDK | 核心引擎，Agent 实例池 |
| CRM DB | TiDB / MySQL | 客户、合同、商机等结构化数据 |
| Vector DB | Milvus / Elasticsearch | 知识库向量检索 + Memory 存储 |
| Cache/Queue | Redis | 会话缓存、消息队列、限流计数 |
| Object Storage | MinIO / S3 | 报告文件、导出的数据文件 |

## 2.10 关键代码示例

### 完整的 Agent 启动与对话流程

```python
# app/agent_service.py

import asyncio
import json
from typing import AsyncIterator
from claude_agent_sdk import (
    query, ClaudeAgentOptions, ResultMessage,
    StreamMessage, ToolUseMessage,
    tool, create_sdk_mcp_server, ToolAnnotations,
    hook, HookEvent, HookMatcher,
)

from app.mcp_servers import (
    create_crm_data_mcp_server,
    create_ad_knowledge_mcp_server,
    create_analytics_mcp_server,
    create_messaging_mcp_server,
    create_document_mcp_server,
    create_workflow_mcp_server,
)
from app.memory import memory_store
from app.auth import permission_service, current_user


class CRMAgentService:
    """CRM AI Agent 服务——单例 Agent，处理所有用户请求"""

    def __init__(self):
        self.sessions: dict[str, str] = {}  # user_id → session_id

    def build_options(
        self,
        user_id: str,
        user_role: str,
        user_department: str,
        task_type: str = "chat",
    ) -> ClaudeAgentOptions:
        """根据用户和任务类型构建 Agent 配置"""

        # 用户上下文注入
        system_prompt = CRM_SYSTEM_PROMPT.format(
            user_role=user_role,
            user_department=user_department,
            current_date="2026-07-27",
        )

        # 根据任务类型选择模型
        model_configs = {
            "chat": ("deepseek-chat", "https://api.deepseek.com/anthropic"),
            "analysis": ("kimi-k2-turbo-preview", "https://api.moonshot.cn/anthropic"),
            "deep_research": ("kimi-k2-turbo-preview", "https://api.moonshot.cn/anthropic"),
            "simple": ("glm-4.5-air", "https://open.bigmodel.cn/api/anthropic"),
        }
        model, base_url = model_configs.get(task_type, model_configs["chat"])

        # 恢复已有会话（如果有）
        session_id = self.sessions.get(user_id)

        return ClaudeAgentOptions(
            # ---- 模型 ----
            model=model,
            fallback_model="deepseek-chat",
            max_thinking_tokens=4000,
            system_prompt=system_prompt,

            # ---- 工具 ----
            allowed_tools=[
                # SDK 原生
                "Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill", "Task",
                # 业务 MCP
                "mcp__crm_data__*",
                "mcp__ad_knowledge__*",
                "mcp__analytics__*",
                "mcp__messaging__*",
                "mcp__document__*",
                "mcp__workflow__*",
            ],
            disallowed_tools=["Bash(rm -rf *)", "Bash(sudo *)"],

            # ---- MCP 服务器 ----
            mcp_servers={
                "crm_data": create_crm_data_mcp_server(),
                "ad_knowledge": create_ad_knowledge_mcp_server(),
                "analytics": create_analytics_mcp_server(),
                "messaging": create_messaging_mcp_server(),
                "document": create_document_mcp_server(),
                "workflow": create_workflow_mcp_server(),
            },

            # ---- 权限 ----
            permission_mode="default",

            # ---- 限制 ----
            max_turns=15,
            max_budget_usd=1.0,

            # ---- 环境 ----
            cwd="/app/workspace",
            add_dirs=["/app/skills", "/app/knowledge"],
            env={
                "ANTHROPIC_BASE_URL": base_url,
                "ANTHROPIC_AUTH_TOKEN": os.environ["ANTHROPIC_AUTH_TOKEN"],
            },

            # ---- 会话 ----
            resume=session_id,
            fork_session=False,

            # ---- Hook ----
            hooks={
                HookEvent.PRE_TOOL_USE: [
                    HookMatcher(matcher="mcp__crm_data__*", hooks=[crm_data_access_control]),
                    HookMatcher(matcher="mcp__messaging__*", hooks=[messaging_approval]),
                ],
            },

            # ---- 高级 ----
            setting_sources=["project"],
            enable_file_checkpointing=True,
        )

    async def chat(
        self,
        user_id: str,
        user_message: str,
        user_role: str = "sales",
        user_department: str = "华东区",
    ) -> AsyncIterator[dict]:
        """
        与 Agent 对话的核心接口。

        使用 Server-Sent Events (SSE) 或 WebSocket 向前端推送流式响应。
        """
        options = self.build_options(user_id, user_role, user_department)

        # 流式调用 Agent
        async for message in query(prompt=user_message, options=options):
            if isinstance(message, StreamMessage):
                # 流式文本块 → 推送给前端
                yield {
                    "type": "text_delta",
                    "content": message.text,
                }

            elif isinstance(message, ToolUseMessage):
                # 工具调用开始 → 通知前端（可选展示）
                yield {
                    "type": "tool_call",
                    "tool_name": message.name,
                    "tool_input": message.input,
                }

            elif isinstance(message, ResultMessage):
                # 最终结果
                if message.subtype == "success":
                    # 保存会话 ID 以便下次恢复
                    self.sessions[user_id] = message.session_id

                    yield {
                        "type": "done",
                        "content": message.result,
                        "usage": {
                            "input_tokens": message.usage.input_tokens,
                            "output_tokens": message.usage.output_tokens,
                        },
                    }
                else:
                    yield {
                        "type": "error",
                        "content": str(message.error),
                    }

    async def execute_scheduled_report(self, report_config: dict):
        """
        执行定时报告任务（由 Job Server 触发）。

        示例：每天早上8点为所有销售生成晨报。
        """
        for user in report_config["recipients"]:
            prompt = f"""
            请为 {user['name']} 生成今日晨间准备报告。
            用户负责的客户范围：{user['customer_scope']}
            关注指标：消耗趋势、ROI变化、异常客户、今日待办。

            要求：
            1. 先查询客户的近7天消耗数据和变化趋势
            2. 识别出异常客户（消耗波动>30%、ROI显著下降等）
            3. 列出今日待跟进事项
            4. 输出为 Markdown 格式，生成文件保存到 /app/reports/{user['id']}/daily_{today}.md
            5. 最后通过 messaging 推送给用户
            """

            # 异步执行（不等待结果）
            asyncio.create_task(
                self._run_and_push(user["id"], prompt, user["id"])
            )

    async def _run_and_push(self, user_id: str, prompt: str, recipient_id: str):
        """执行 Agent 任务并推送结果"""
        options = self.build_options(user_id, "sales", "华东区")

        async for message in query(prompt=prompt, options=options):
            if isinstance(message, ResultMessage) and message.subtype == "success":
                # Agent 已经通过 messaging MCP 推送给用户
                # 这里记录执行日志
                logger.info(f"定时报告完成: user={user_id}, tokens={message.usage.total_tokens}")


# ---- 全局单例 ----
agent_service = CRMAgentService()
```

### FastAPI 接口示例

```python
# app/api/chat.py

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.agent_service import agent_service
from app.auth import get_current_user
import json

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    user = Depends(get_current_user),
):
    """
    SSE 流式对话接口。

    前端通过 EventSource 或 fetch + ReadableStream 接收流式响应。
    """
    async def event_generator():
        async for event in agent_service.chat(
            user_id=user.id,
            user_message=request.message,
            user_role=user.role,
            user_department=user.department,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/sync")
async def chat_sync(
    request: ChatRequest,
    user = Depends(get_current_user),
):
    """
    同步对话接口（非流式，适用于自动化场景）。
    """
    results = []
    async for event in agent_service.chat(
        user_id=user.id,
        user_message=request.message,
        user_role=user.role,
        user_department=user.department,
    ):
        results.append(event)

    # 提取最终结果
    final = next((r for r in results if r["type"] == "done"), None)
    if final:
        return {"status": "success", "content": final["content"], "usage": final["usage"]}
    else:
        return {"status": "error", "content": "未获取到结果"}


@router.post("/deep-research")
async def deep_research(
    request: DeepResearchRequest,
    user = Depends(get_current_user),
):
    """
    深度调研接口——唯一使用多 Agent 的场景。

    此接口将研究任务分解后并行执行，耗时较长（分钟级）。
    建议前端轮询或通过 WebSocket 获取进度。
    """
    # 生成本次调研的任务ID
    research_id = f"research_{uuid.uuid4().hex[:8]}"

    # 异步启动调研
    asyncio.create_task(
        _run_deep_research(research_id, request.topic, user)
    )

    return {
        "status": "started",
        "research_id": research_id,
        "message": "深度调研已启动，请通过 /research/{research_id}/status 查询进度",
    }


async def _run_deep_research(research_id: str, topic: str, user):
    """后台执行深度调研"""
    prompt = f"""
    [Deep Research Mode]
    请对以下主题进行深度调研：{topic}

    请调用 deep-research Skill 了解执行流程。
    按照阶段1→阶段2→阶段3→阶段4 完成调研，最终输出完整的调研报告。
    报告保存到 /app/reports/{research_id}/report.md
    """

    async for event in agent_service.chat(
        user_id=user.id,
        user_message=prompt,
        user_role=user.role,
        user_department=user.department,
    ):
        # 将事件流记录到状态存储
        await status_store.append_event(research_id, event)

    await status_store.mark_complete(research_id)
```

---

## 附录：技术选型速查表

| 层次 | 技术 | 选型理由 |
|------|------|---------|
| **Agent 引擎** | Claude Agent SDK (Python) | 唯一满足"灵活Agent大脑+原生工具+MCP+Skill"的方案 |
| **后端框架** | FastAPI | 异步原生、WebSocket支持、生态好 |
| **任务队列** | Celery + Redis | 定时报告、批量任务、异步 Deep Research |
| **结构化数据** | MySQL / TiDB | 客户、合同、商机等 |
| **向量数据库** | Milvus | 知识库语义检索 + Memory 向量存储 |
| **搜索引擎** | Elasticsearch | 全文搜索 + 日志检索 |
| **缓存** | Redis | 会话缓存、速率限制、消息队列 |
| **对象存储** | MinIO / 火山引擎 TOS | 报告文件、导出的数据 |
| **大模型** | DeepSeek / Kimi / GLM / Qwen | 国产模型，Anthropic 格式兼容 |
| **模型代理** | claude-proxy / claude-code-router | 可选：动态切换模型供应商 |
| **前端** | React + Vite | 现代前端框架 |
| **认证** | OAuth 2.0 (飞书/企业微信 SSO) | 企业内部统一认证 |
| **监控** | Prometheus + Grafana | 标准监控方案 |
| **日志** | ELK (ES + Logstash + Kibana) | 分布式日志追踪 |

---

> **最后的叮嘱**：
>
> 记住，你的 Agent 是 Claude Code 级别的聪明大脑。它不需要你告诉它"先做A再做B"——你只需要告诉它**能做什么**（MCP工具），**应该怎么思考**（Skill），剩下的交给它自己判断。
>
> 你写的每一行 `if-else` 工作流代码，都是对你 Agent 智商的侮辱。相信它，它比你想象的要聪明得多。

---

# Part 3: v2.0 深化补遗 — 架构哲学深水区

> **日期**: 2026-07-27  
> **版本**: v1.0 → v2.0  
> **说明**: 本章为对 v1.0 架构文档的深化补充，涵盖"为什么单 Agent"的底层论证、Bash 的"逃生舱"理论、MCP 粒度哲学、Skill-MCP 协作机制、Memory 动态注入、模型兼容性风险和分布式 Session 等关键深化。

---

## 3.1 为什么是"一个 Agent"？——底层论证

### 3.1.1 多 Agent 架构的三个隐性成本

**第一，上下文割裂。** Agent A 查出来的数据，Agent B 看不到原始结果，只能看到 A 传来的摘要。摘要有信息损失——查出 50 条客户记录，A 只传了 TOP 10 给 B。B 发现异常模式需要看原始数据时，拿不到。在单 Agent 架构里，Agent 大脑全程持有完整的工具调用历史和返回结果，它可以随时决定"我需要回去再看看那个数据"。

**第二，协调成本。** 多 Agent 需要一个"编排者"决定谁做什么、什么顺序、怎么汇总。这个编排者要么是硬编码工作流（回到 LangGraph），要么是另一个 Agent（套娃）。不管是哪种，都增加了延迟、失败面和调试难度。

**第三，调试地狱。** "最终报告数据不对"——是查数据的 Agent 查错了？还是分析 Agent 理解错了？还是汇总 Agent 写错了？在单 Agent 架构里，整个推理链是一根线，顺着工具调用历史就能定位。

### 3.1.2 单 Agent 成立的两个前提

**前提一：模型足够聪明。** 2026 年的 `deepseek-v4-pro`（1.6T/49B active）、`kimi-k2.6`（1T/32B active）处理 10-15 步工具调用链完全没问题。`max_turns=15` 是合理设置。

**前提二：工具体系设计得好。** 单 Agent 的"无限灵活"源自按需选择工具。MCP 粒度太粗则 Agent "有劲儿使不出"，太细则选择困难。见 3.3 节的三层分类法。

### 3.1.3 什么时候真的需要多 Agent？

**当且仅当任务可分解为 N 个互不依赖的独立检索子任务时。**
- Deep Research: 5 个子方向各自搜索、各自总结，互不依赖 → ✅ 多 Agent 并行
- 客户分析: 必须先查数据，再基于数据分析 → ❌ 不能拆，必须是一个 Agent 的两步操作

---

## 3.2 Bash 不是"万能扳手"，是"逃生舱"

传统 RPA/低代码平台的最大痛点：遇到没被预先封装的场景，用户就死了。

**场景**："帮我把这 50 个客户的近 30 天消耗数据，按行业分类汇总后，生成一个对比去年同期增长率的热力图。"

如果只有 MCP 工具：需要 query_consumption 支持同比、支持按行业聚合、需要一个 generate_heatmap 工具——任何一环缺失就完不成。

**在单 Agent + Bash 架构里**：
1. `query_consumption` 拿到原始数据
2. Bash 写 15 行 Python（pandas + matplotlib/seaborn），现场处理数据、计算同比、生成热力图
3. 保存图片返回用户

这就是"逃生舱"——你不需要预判所有需求，只需确保 Agent 有能力自己解决问题。Bash 就是这个能力的载体。

**Write + Edit 赋予 Agent "产出物"能力**：Agent 能保存报告为 Markdown、修改已有文件、Glob 定位之前生成的文件。`cwd="/app/workspace"` + `enable_file_checkpointing=True` 意味着 Agent 有"工作空间"——产出物可持久化、可追溯、可被后续对话引用。

---

## 3.3 MCP 工具设计的"粒度哲学"——三层分类法

| 层级 | 特征 | 例子 | 原则 |
|------|------|------|------|
| **原子操作** | 一次调用完成一个明确的 CRUD | `search_customers`, `send_message` | 粒度足够细，Agent 可灵活组合 |
| **聚合查询** | 跨实体、带聚合逻辑的读操作 | `query_consumption`（多维聚合+同环比） | 把计算推给数据库，减少 Agent 端处理量。出现条件：数据量大到不能让 Agent 端处理（百万行级别） |
| **复合操作** | 有副作用的写操作，涉及多个系统 | `create_task`（写 CRM + 发通知） | 封装事务边界，避免 Agent 手动处理分布式一致性问题 |

**关键判断**：`query_consumption` 是一个"胖"工具——为什么不做成"先查原始数据让 Agent 自己用 Bash 算"？因为消耗数据可能百万行，传回 Agent 再处理不现实。所以"胖"工具的出现条件是**数据量大到不能让 Agent 端处理**。这个度是 MCP 设计的核心权衡。

---

## 3.4 MCP 工具描述的措辞——"when to use vs when not to use"

Claude Agent SDK 依赖工具描述做工具选择决策。最佳实践是同时说明"何时使用"和"何时不应使用"：

```
✅ 好:
"搜索客户。当你需要查找/列出/筛选客户时使用此工具（而非获取单个客户详情）。
注意：此工具返回简要信息。如需查看合同、投放详情等完整信息，请用 get_customer_detail。"

❌ 一般:
"搜索客户。支持按名称关键词、行业、区域筛选。"
```

这个"when to use vs when not to use"的提示能显著减少 Agent 选错工具的概率。在 11 个 MCP 工具 + 8 个原生工具的环境里，工具选择的准确性直接影响用户体验。

---

## 3.5 Skill 体系的真正威力

### 3.5.1 Skill 不是"文档"，是"认知框架注入"

加载 Skill 后，Agent 不只是"知道了一些分析方法"，而是获得了一套**结构化的认知框架**：
- 输入触发器（"用户问了关于XX的问题"）
- 分析步骤（先画像 → 再趋势 → 再健康度 → 再流失信号）
- 输出规范（结构化呈现、关键数字突出、建议具体可操作）
- 参考数据（行业分类、评分模型、信号清单）

质量差异是数量级的。没有 Skill："XX客户消耗下降了，建议关注"。有 Skill："XX客户消耗近2月下降32%，已触发流失预警（命中3/5信号），建议优先联系，以下是具体干预方案..."。

### 3.5.2 Skill 精确引用 MCP 工具名——"脑"编排"手"

一个好的 Skill 会精确引用 MCP 工具名，让 Skill 从"泛泛指导"变为"可执行 SOP"：

```markdown
## 投放诊断流程
1. 获取客户数据 → 调用 mcp__crm_data__get_customer_detail
2. 获取消耗数据 → 调用 mcp__crm_data__query_consumption（近90天，按天，环比）
3. 获取行业基准 → 调用 mcp__ad_knowledge__search_ad_knowledge(category="strategy")
4. 对比诊断 → 差距最大的环节
5. 生成建议 → 针对瓶颈环节
```

Skill 与 MCP 的关系精确化为：**MCP 定义了"可能性的边界"（你能触碰哪些外部系统），Skill 定义了"在特定情境下的最佳行为模式"（你应该怎么思考和使用这些工具）。两者不是独立体系，而是 Skill 编排 MCP。**

### 3.5.3 渐进式加载的"隐形福利"

20 个 Skill → 每个只有 ~100 tokens 元数据在启动时加载 → Agent 按需选择加载完整内容。这意味着你可以**无限扩展 Skill 而不会撑爆上下文窗口**。这和 Claude Code 管理 50+ Skill 的机制完全一样——复用了已验证的扩展模式。

---

## 3.6 Memory 最关键的功能：在正确的时机被召回

Memory 的价值不在于"存"，而在于"召回的时机"。我们的架构选择 **方案A：系统级预注入**——在构建 `ClaudeAgentOptions` 之前，同步调用 `recall` 查询相关记忆，拼入 `system_prompt`：

```
## 你的记忆（与当前对话相关）
- 💡 用户偏好以图表而非表格展示数据（上次反馈）
- 📋 用户最常查询的客户: C001, C003, C007
- 📌 用户是华东区销售，关注教育行业
```

这不依赖 Agent 自己记得调用 recall 工具——"检索记忆"是系统级默认行为，而非 Agent 的自觉性。生产环境更可靠。

---

## 3.7 国产模型兼容性风险（2026年7月更新）

### 3.7.1 模型名称已变更

| 旧名（已弃用） | 新名 | 弃用日期 |
|-------------|------|---------|
| `deepseek-chat` | `deepseek-v4-pro` | 2026-07-24 |
| `deepseek-reasoner` | `deepseek-v4-pro` (thinking mode) | 2026-07-24 |
| `kimi-k2-turbo-preview` | `kimi-k2.6` | 2026 年 |

**注意**：`deepseek-reasoner` 被映射到 `deepseek-v4-flash`（非 Pro），推理任务必须显式切换到 Pro。

### 3.7.2 Kimi 的 Anthropic 端点已知差异

根据 Moonshot GitHub issue #129：
- `temperature` 被内部缩放（实际值 = 传入值 × 0.6）
- `document` 类型的 content block 返回 400
- `thinking` 在多轮工具调用中可能返回 400
- 不支持 prompt caching

**应对策略**：
- 设置 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
- 对 Kimi 端点，`max_thinking_tokens` 保守设为 None
- 模型兼容性配置表（`app/model_compat.py`）集中管理

### 3.7.3 模型路由策略升级

不只是在构建 options 时选择模型。可以在 Hook 中做运行时切换——如果一个请求连续 3 轮工具调用后仍没完成，自动切换到更强模型。这就是 `fallback_model` 参数的设计意图。

---

## 3.8 分布式 Session 管理

`agent_service.py` v0.6 用 `self.sessions: dict` 内存字典存储 user_id → session_id。但多 worker 部署时：
- 请求打到 worker A → 创建 session
- 下次请求打到 worker B → 找不到 session

**生产级方案**（v1.0 已实现）：
- Session 存入 Redis（`app/session_store.py`），24h TTL
- 开发环境自动降级为内存存储
- 前端也可在 `ChatRequest.session_id` 中携带

---

## 3.9 安全架构补充：静默过滤 vs 明确拒绝

CRM 场景中的数据权限有两种处理方式：

| 方式 | 行为 | 适用场景 |
|------|------|---------|
| **明确拒绝** | 返回"你没有权限查看该客户" | 内部销售工具（当前选择） |
| **静默过滤** | 自动过滤无权限数据，不告知用户 | 高安全策略环境 |

当前选择**明确拒绝**——因为销售需要知道"为什么看不到？是我权限问题还是客户不存在？"从而主动申请权限。但需注意：在某些安全策略下，"你没有权限"本身就泄露了信息（"这个客户存在于系统中"）。这是一个需要在答辩时展示"考虑过"的设计权衡。

---

## 附录 A: v2.0 项目文件变更

| 文件 | 变更 | 说明 |
|------|------|------|
| `.env` | 新增 | 真实 API Key + 更新模型名 |
| `.env.example` | 更新 | deepseek-v4-pro / kimi-k2.6 |
| `app/agent_service.py` | 重写 | Memory预注入 + Redis Session + 模型兼容性 |
| `app/session_store.py` | 新增 | Redis分布式Session管理 |
| `app/model_compat.py` | 新增 | 模型兼容性注册表（temperature/thinking/caching差异） |
| `app/mcp_servers/*.py` | 更新 | 工具描述加入"when to use / when not to use" |
| `skills/ad-strategy/SKILL.md` | 已有 | 精确引用 MCP 工具名（可执行 SOP 模式） |

## 附录 B: 答辩核心论述（30秒版）

> 我的架构和传统 AI 应用架构的本质区别在于：我没有预设用户的交互路径。
>
> 传统架构（LangChain/LangGraph）的工作方式是"产品经理想清楚用户要什么 → 程序员写成工作流 DAG → 用户只能走预设路径"。这个模式的问题在于——用户的需求是无限的，而预设路径是有限的。
>
> 我的架构的工作方式是"给 Agent 一套强大的原生能力（Bash、文件操作、代码执行）+ 一系列业务工具（通过 MCP 封装）+ 领域方法论（通过 Skill 注入）→ Agent 大脑自主决定每一步做什么"。
>
> 这不是一个"问答系统"，也不是一个"工作流引擎"。这是一个有 CRM 领域知识的、有行动能力的数字同事。它不像传统 SaaS 工具那样要求用户"学会使用工具"，而是 Agent 自己去适应——用户只需用自然语言描述需求，Agent 自主规划、调用工具、产出结果。
>
> 而这一切的基石是 Claude Agent SDK——它与 Claude Code 共享内核。Claude Code 已经每天被数百万开发者用来写代码、调试、部署，它的 Agent 循环、工具调用、Skill 系统、权限模型都是经过极端场景验证的。我们不需要从零构建 Agent 循环——我们站在一个已经证明自己的肩膀上，聚焦于 CRM 领域的业务封装。
