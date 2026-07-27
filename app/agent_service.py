"""
CRM AI 工作台 — 核心 Agent 服务 (生产级 v1.0)

基于 Claude Agent SDK，实现:
  1. Agent 实例生命周期管理
  2. Session 持久化 (Redis) — 多 worker 共享
  3. Memory 预注入 — 系统级行为，不依赖 Agent 自觉
  4. 模型兼容性感知 — 自动调整 thinking/temperature
  5. 流式对话 (SSE)
  6. Deep Research 异步执行
  7. 定时报告任务

架构哲学: One Smart Agent，按需调用 MCP 工具 + 加载 Skill。
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime
from typing import AsyncIterator

from claude_agent_sdk import (
    query, ClaudeAgentOptions, ResultMessage,
    StreamMessage, ToolUseMessage,
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
from app.memory.memory_store import memory_store
from app.session_store import session_store
from app.model_compat import get_model_config, get_recommended_model
from app.models.schemas import User, TaskType


# ============================================================
# 系统提示词 (含 Memory 占位符)
# ============================================================

CRM_SYSTEM_PROMPT = """你是 CRM AI 智能工作台的智能助手，服务于字节跳动商业化团队的销售、运营和管理人员。

## 你的核心能力
1. **数据查询**：通过 MCP 工具查询 CRM 系统中的客户、合同、商机、消耗等数据
2. **知识检索**：检索广告投放政策、最佳实践、行业案例等知识
3. **策略分析**：基于数据和知识，为客户提供投放优化、拓客建议等策略
4. **报告生成**：使用 Write 工具生成客户报告、团队报告、行业分析报告，保存到 /app/workspace 目录
5. **数据分析**：使用 analytics MCP 工具进行趋势分析、异常检测、客户分层等
6. **消息推送**：使用 messaging MCP 工具推送报告、告警、提醒
7. **任务管理**：使用 workflow MCP 工具创建和跟踪 CRM 任务

## 你的工具箱
除了上述业务 MCP 工具，你还拥有完整的原生工具能力：
- **Bash**: 执行 Shell/Python 脚本 — 这是你的"逃生舱"。任何 MCP 工具无法直接完成的数据处理，你都可以现场写 Python 脚本解决
- **Write / Edit / Read**: 文件系统操作 — 持久化报告、修改配置、读取上下文
- **Glob / Grep**: 文件搜索 — 在 workspace 中定位已有资源
- **Skill**: 加载领域技能 — 当你需要特定领域方法论时加载对应 Skill

## 工作原则
- **按需使用工具**：不需要的步骤不要做。先判断任务类型，再选择合适的工具链
- **数据查询先确认条件**：涉及数据查询时，先确认时间范围、客户范围、指标，再执行
- **策略建议必须有数据支撑**：不要泛泛而谈。调用数据工具获取实据，结合知识库给出具体方案
- **产出物持久化**：使用 Write 工具将报告、分析结果保存为文件，告知用户路径
- **遇到不确定性主动澄清**：不要猜测用户的意图，不要假设缺失的参数
- **Bash 是你的超能力**：当需要处理复杂数据时，写 Python 脚本比用多个 MCP 调用更高效

## 技能 (Skills)
使用 Skill 工具加载对应技能获取详细方法论：
- `customer-analysis`: 客户分析、健康度评估、流失预警、拜访准备
- `ad-strategy`: 广告投放策略诊断、出价策略选择、创意优化
- `sales-process`: 销售流程管理、客户开发、异议处理
- `report-generation`: 报告模板、图表标准、格式化输出
- `data-query`: CRM 数据模型、指标口径定义、常见查询模式
- `deep-research`: 深度调研（多 Agent 并行检索 → 交叉验证 → 报告合成）

## 你的记忆 (Memory)
以下是系统根据你的历史交互自动检索到的相关记忆。请参考这些信息来个性化你的回复：
{memory_context}

## 当前上下文
- 用户: {user_name} ({user_role})
- 部门: {user_department}
- 日期: {current_date}
"""


# ============================================================
# 模型路由配置
# ============================================================

# 任务类型 → (模型, base_url)
def _get_model_for_task(task_type: TaskType) -> tuple[str, str]:
    """根据任务类型选择最佳模型"""
    prefer = os.environ.get("PREFER_PROVIDER", "deepseek")
    model_id = get_recommended_model(task_type.value, prefer)

    config = get_model_config(model_id)
    # 如果主模型不可用，尝试 fallback
    if not os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        fallback_id = os.environ.get("ANTHROPIC_FALLBACK_MODEL", "deepseek-v4-pro")
        if fallback_id:
            config = get_model_config(fallback_id)
            model_id = fallback_id

    return model_id, config.base_url


# ============================================================
# Agent Service (生产级)
# ============================================================

class CRMAgentService:
    """
    CRM AI Agent 服务 (生产级)。

    关键改进 (v0.6.0 → v1.0.0):
    - Session 持久化: Redis 后端，多 worker 共享
    - Memory 预注入: 构建 options 前同步检索相关记忆，系统级行为
    - 模型兼容性感知: 自动获取模型配置，动态调整 thinking
    - 模型名更新: deepseek-v4-pro / kimi-k2.6 (替换已弃用的旧名)
    """

    def __init__(self):
        pass  # Session 由 session_store 管理，不再用内存 dict

    # ---- Memory 预注入 ----

    async def _build_memory_context(self, user: User, message: str) -> str:
        """
        检索与当前对话相关的记忆，注入 system prompt。

        这是系统级行为——不依赖 Agent 自己记得调用 recall 工具。
        """
        try:
            memories = await memory_store.search(
                query=message,
                user_id=user.id,
                top_k=5,
            )
            if not memories:
                return "（暂无相关记忆）"

            lines = []
            for m in memories:
                cat_emoji = {
                    "user_preference": "💡",
                    "user_feedback": "📝",
                    "lesson_learned": "📌",
                    "fact": "📋",
                }.get(m["category"], "📎")
                lines.append(f"- {cat_emoji} {m['content']}")

            return "\n".join(lines)
        except Exception:
            return "（记忆检索不可用）"

    # ---- 构建 Agent 配置 ----

    def build_options(
        self,
        user: User,
        task_type: TaskType = TaskType.CHAT,
        session_id: str | None = None,
        memory_context: str = "",
    ) -> ClaudeAgentOptions:
        """构建 ClaudeAgentOptions (生产级)"""

        # 系统提示词（含 Memory）
        system_prompt = CRM_SYSTEM_PROMPT.format(
            user_name=user.name,
            user_role=user.role.value,
            user_department=user.department,
            current_date=datetime.now().strftime("%Y-%m-%d"),
            memory_context=memory_context or "（暂无相关记忆）",
        )

        # 模型选择 + 兼容性配置
        model_id, base_url = _get_model_for_task(task_type)
        model_config = get_model_config(model_id)

        # thinking 配置 (Kimi 多轮必须关)
        thinking_tokens = None
        if model_config.supports_thinking and not model_config.disable_thinking_default:
            thinking_tokens = 4000

        return ClaudeAgentOptions(
            # ---- 模型 ----
            model=model_id,
            fallback_model=os.environ.get("ANTHROPIC_FALLBACK_MODEL", "deepseek-v4-pro"),
            max_thinking_tokens=thinking_tokens,
            system_prompt=system_prompt,

            # ---- 工具 ----
            allowed_tools=[
                # SDK 原生 (保留全部灵活能力)
                "Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill", "Task",
                # 业务 MCP
                "mcp__crm_data__*",
                "mcp__ad_knowledge__*",
                "mcp__analytics__*",
                "mcp__messaging__*",
                "mcp__document__*",
                "mcp__workflow__*",
            ],
            disallowed_tools=[
                "Bash(rm -rf *)",
                "Bash(sudo *)",
            ],

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
                "ANTHROPIC_AUTH_TOKEN": os.environ.get("ANTHROPIC_AUTH_TOKEN", ""),
                "ANTHROPIC_SMALL_FAST_MODEL": os.environ.get("ANTHROPIC_SMALL_FAST_MODEL", "deepseek-v4-flash"),
                # Kimi 兼容性
                "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1" if not model_config.supports_prompt_caching else "0",
            },

            # ---- 会话 ----
            resume=session_id,
            fork_session=False,

            # ---- Hook ----
            hooks={
                HookEvent.PRE_TOOL_USE: [
                    HookMatcher(matcher="mcp__crm_data__*", hooks=[crm_data_access_control_wrapper]),
                    HookMatcher(matcher="mcp__messaging__*", hooks=[messaging_approval_wrapper]),
                ],
            },

            # ---- 高级 ----
            setting_sources=["project"],
            enable_file_checkpointing=True,
        )

    # ---- 核心对话接口 (生产级) ----

    async def chat(
        self,
        user: User,
        message: str,
        task_type: TaskType = TaskType.CHAT,
    ) -> AsyncIterator[dict]:
        """
        流式对话 (生产级)。

        流程:
          1. 从 Redis 加载 session_id (多 worker 共享)
          2. 检索 Memory 并预注入 system prompt
          3. 构建兼容性感知的 Agent 配置
          4. 流式执行 Agent
          5. 保存 session_id 回 Redis
          6. 异步保存用户偏好到 Memory (不阻塞响应)
        """
        # 1. 加载 session
        session_data = await session_store.load(user.id)
        session_id = session_data["session_id"] if session_data else None

        # 2. 预注入 Memory
        memory_context = await self._build_memory_context(user, message)

        # 3. 构建配置
        options = self.build_options(user, task_type, session_id, memory_context)
        user_context = {"user": user, "task_type": task_type.value}

        # 4. 流式执行
        async for msg in query(prompt=message, options=options, context=user_context):
            if isinstance(msg, StreamMessage):
                yield {"type": "text_delta", "content": msg.text}

            elif isinstance(msg, ToolUseMessage):
                yield {
                    "type": "tool_call",
                    "tool_name": msg.name,
                    "tool_input": getattr(msg, "input", {}),
                }

            elif isinstance(msg, ResultMessage):
                if msg.subtype == "success":
                    # 5. 保存 session
                    await session_store.save(user.id, msg.session_id)
                    await session_store.touch(user.id)

                    yield {
                        "type": "done",
                        "content": msg.result,
                        "usage": {
                            "input_tokens": getattr(msg.usage, "input_tokens", 0),
                            "output_tokens": getattr(msg.usage, "output_tokens", 0),
                        },
                    }
                else:
                    yield {"type": "error", "content": str(getattr(msg, "error", "未知错误"))}

    # ---- Deep Research ----

    async def start_deep_research(self, user: User, topic: str) -> str:
        """启动深度调研 (异步后台执行)"""
        research_id = f"research_{uuid.uuid4().hex[:8]}"
        asyncio.create_task(self._run_deep_research(research_id, user, topic))
        return research_id

    async def _run_deep_research(self, research_id: str, user: User, topic: str):
        """后台执行深度调研"""
        memory_context = await self._build_memory_context(user, topic)
        options = self.build_options(user, TaskType.DEEP_RESEARCH, memory_context=memory_context)

        prompt = f"""[Deep Research Mode]
请对以下主题进行深度调研: {topic}

请首先调用 Skill 工具加载 `deep-research` 技能获取调研方法论。
然后按照技能指导完成:
1. 任务分解: 拆分为 3-5 个独立子方向
2. 并行调研: 使用 search_ad_knowledge、search_documents 等工具分头检索
3. 交叉验证: 对比不同来源，标注矛盾
4. 报告合成: 生成结构化 Markdown 报告，保存到 /app/workspace/reports/{research_id}/report.md
"""
        async for msg in query(prompt=prompt, options=options):
            pass  # 后台执行，结果写入文件

    # ---- 定时报告 ----

    async def execute_scheduled_report(self, report_config: dict):
        """执行定时报告 (由 Celery Job Server 触发)"""
        for recipient in report_config.get("recipients", []):
            user = User(
                id=recipient["user_id"],
                name=recipient["name"],
                role=recipient.get("role", "sales"),
                department=recipient.get("department", "华东区"),
            )
            date_str = datetime.now().strftime("%Y%m%d")
            prompt = f"""请为 {user.name} 生成今日晨间准备报告。

步骤:
1. search_customers 查询负责的客户
2. 对重点客户 query_consumption 获取近7天消耗趋势
3. run_analysis(type="anomaly") 检测异常客户
4. Write 保存报告到 /app/workspace/reports/{user.id}/daily_{date_str}.md
5. send_message 推送给用户

报告包含: 今日重点客户、异常告警、消耗趋势、待办建议。
"""
            asyncio.create_task(self._run_report(user, prompt))

    async def _run_report(self, user: User, prompt: str):
        """执行单个报告生成并推送"""
        options = self.build_options(user, TaskType.CHAT, memory_context="")
        async for msg in query(prompt=prompt, options=options):
            pass


# ============================================================
# Hook 包装函数
# ============================================================

async def crm_data_access_control_wrapper(tool_name, tool_input, context):
    from app.hooks.security_hooks import crm_data_access_control
    return await crm_data_access_control(tool_name, tool_input, context)


async def messaging_approval_wrapper(tool_name, tool_input, context):
    from app.hooks.security_hooks import messaging_approval
    return await messaging_approval(tool_name, tool_input, context)


# 全局单例
agent_service = CRMAgentService()
