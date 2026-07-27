"""
CRM AI 工作台 — 数据模型与 Schema

所有请求/响应模型定义，纯 Pydantic，不依赖任何外部服务。
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


# ============================================================
# 枚举
# ============================================================

class UserRole(StrEnum):
    SALES = "sales"
    OPERATIONS = "operations"
    MANAGER = "manager"
    AGENT = "agent"  # 代理商/服务商
    ANALYST = "analyst"


class TaskType(StrEnum):
    CHAT = "chat"
    ANALYSIS = "analysis"
    DEEP_RESEARCH = "deep_research"
    SIMPLE = "simple"


class CustomerLevel(StrEnum):
    S = "S"  # 战略客户
    A = "A"
    B = "B"
    C = "C"


class HealthStatus(StrEnum):
    HEALTHY = "healthy"
    WARNING = "warning"
    RISK = "risk"


class TaskPriority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class MessageChannel(StrEnum):
    FEISHU = "feishu"
    WECOM = "wecom"


class MessageType(StrEnum):
    TEXT = "text"
    MARKDOWN = "markdown"
    CARD = "card"
    FILE = "file"


class ReportType(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


# ============================================================
# 用户 & 认证
# ============================================================

class User(BaseModel):
    """当前登录用户"""
    id: str
    name: str
    role: UserRole
    department: str  # 如 "华东区"
    permissions: list[str] = Field(default_factory=list)
    managed_customers: list[str] = Field(default_factory=list)  # 可访问的客户ID列表


# ============================================================
# CRM 领域模型
# ============================================================

class CustomerBrief(BaseModel):
    """客户简要信息（列表返回）"""
    id: str
    name: str
    industry: str
    region: str
    level: CustomerLevel
    owner: str  # 销售负责人
    owner_name: str
    cost_30d: float = 0.0  # 近30天消耗
    health_status: HealthStatus = HealthStatus.HEALTHY


class CustomerDetail(BaseModel):
    """客户360°画像"""
    id: str
    name: str
    industry: str
    sub_industry: str | None = None
    region: str
    scale: str | None = None  # 企业规模
    level: CustomerLevel
    owner: str
    owner_name: str

    # 合作信息
    first_coop_date: str | None = None  # 首次合作日期
    contract_status: str | None = None  # 合同状态
    contract_end_date: str | None = None

    # 投放概况
    main_products: list[str] = Field(default_factory=list)  # 主要投放产品
    active_accounts: int = 0  # 活跃账户数
    cost_30d: float = 0.0
    cost_trend: str = "stable"  # rising / stable / declining

    # 财务
    total_arrears: float = 0.0  # 总欠款
    payment_rating: str = "A"  # 回款评级

    # 服务
    service_rating: float = 5.0  # 服务满意度
    recent_tickets: int = 0  # 近期工单数

    # 健康度
    health_status: HealthStatus = HealthStatus.HEALTHY
    health_score: int = 100
    churn_signals: list[str] = Field(default_factory=list)


class ConsumptionRecord(BaseModel):
    """消耗数据记录"""
    date: str
    customer_id: str
    cost: float
    impression: int = 0
    click: int = 0
    ctr: float = 0.0
    cvr: float = 0.0
    roi: float = 0.0


class ConsumptionAggregation(BaseModel):
    """消耗聚合结果"""
    dimensions: dict[str, str]  # 聚合维度值
    cost: float
    cost_prev: float | None = None  # 上期（同比/环比）消耗
    cost_change_pct: float | None = None  # 变化百分比
    impression: int = 0
    click: int = 0
    ctr: float = 0.0
    cvr: float = 0.0
    roi: float = 0.0


# ============================================================
# 知识库
# ============================================================

class KnowledgeItem(BaseModel):
    """知识条目（搜索结果）"""
    id: str
    title: str
    content: str  # 摘要
    full_content: str | None = None  # 完整内容（详情接口返回）
    category: str  # policy / strategy / case / product / faq
    source: str
    tags: list[str] = Field(default_factory=list)
    relevance_score: float = 1.0
    updated_at: str | None = None


# ============================================================
# 分析
# ============================================================

class AnalysisRequest(BaseModel):
    """分析请求"""
    analysis_type: Literal["trend", "anomaly", "rfm", "cohort", "funnel"]
    params: dict[str, Any] = Field(default_factory=dict)


class AnalysisResult(BaseModel):
    """分析结果"""
    analysis_type: str
    summary: str
    data: list[dict[str, Any]] = Field(default_factory=list)
    chart_data: dict[str, Any] | None = None  # 前端图表数据
    insights: list[str] = Field(default_factory=list)


# ============================================================
# 消息
# ============================================================

class MessageRequest(BaseModel):
    """发送消息请求"""
    channel: MessageChannel = MessageChannel.FEISHU
    recipient: str  # 用户ID 或 群ID
    content: str
    msg_type: MessageType = MessageType.MARKDOWN


# ============================================================
# 任务
# ============================================================

class TaskCreateRequest(BaseModel):
    """创建任务请求"""
    title: str
    description: str = ""
    assignee: str
    customer_id: str | None = None
    due_date: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM


class TaskInfo(BaseModel):
    """任务信息"""
    id: str
    title: str
    description: str
    assignee: str
    customer_id: str | None = None
    due_date: str | None = None
    priority: TaskPriority
    status: str = "pending"
    created_at: str


# ============================================================
# API 请求/响应
# ============================================================

class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., min_length=1, max_length=10000)
    user_role: UserRole | None = None
    task_type: TaskType = TaskType.CHAT
    session_id: str | None = None  # 恢复已有会话


class ChatEvent(BaseModel):
    """SSE 流式事件"""
    type: Literal["text_delta", "tool_call", "tool_result", "done", "error"]
    content: str | None = None
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    usage: dict[str, int] | None = None


class DeepResearchRequest(BaseModel):
    """深度调研请求"""
    topic: str = Field(..., min_length=5, max_length=500)
    depth: Literal["quick", "standard", "comprehensive"] = "standard"


class DeepResearchStatus(BaseModel):
    """Deep Research 状态"""
    research_id: str
    status: Literal["pending", "in_progress", "collecting", "verifying", "synthesizing", "done", "error"]
    progress: int = 0  # 0-100
    events: list[dict[str, Any]] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None


# ============================================================
# Memory
# ============================================================

class MemoryEntry(BaseModel):
    """记忆条目"""
    id: str
    content: str
    category: Literal["user_preference", "user_feedback", "lesson_learned", "fact"]
    tags: list[str] = Field(default_factory=list)
    user_id: str
    timestamp: str
    score: float | None = None  # 检索相关度


class MemoryRecallRequest(BaseModel):
    """记忆检索请求"""
    query: str
    category: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)


# ============================================================
# 配置
# ============================================================

class ModelConfig(BaseModel):
    """模型配置"""
    provider: str  # deepseek / kimi / glm / qwen
    base_url: str
    model: str
    api_key: str
