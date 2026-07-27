"""
模型兼容性配置 — 管理不同模型的差异行为

每个模型提供商在 Anthropic 兼容端点上的行为差异。
在切换模型前应检查此配置。
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ModelCompatConfig:
    """单个模型的兼容性配置"""
    provider: str
    model_id: str
    base_url: str

    # --- 行为差异 ---
    temperature_scale: float = 1.0       # temperature 缩放系数（Kimi: 0.6）
    supports_thinking: bool = True        # 是否支持 thinking/reasoning
    thinking_multiturn_ok: bool = True    # thinking 在多轮工具调用中是否正常
    supports_document_block: bool = True  # 是否支持 document 类型 content block
    supports_prompt_caching: bool = True  # 是否支持 Anthropic prompt caching
    supports_image: bool = True           # 是否支持图片输入

    # --- 限制 ---
    max_output_tokens: int = 32768        # 最大输出 token

    # --- 建议 ---
    recommended_for: list[str] = field(default_factory=list)  # 适合的任务类型
    disable_thinking_default: bool = False  # 是否默认关闭 thinking


# ============================================================
# 模型兼容性注册表
# ============================================================

MODEL_REGISTRY: dict[str, ModelCompatConfig] = {
    # --- DeepSeek V4 系列 ---
    "deepseek-v4-pro": ModelCompatConfig(
        provider="deepseek",
        model_id="deepseek-v4-pro",
        base_url="https://api.deepseek.com/anthropic",
        temperature_scale=1.0,
        supports_thinking=True,
        thinking_multiturn_ok=True,
        supports_document_block=True,
        supports_prompt_caching=True,  # DeepSeek 支持但格式不同，SDK自动处理
        supports_image=True,
        max_output_tokens=384000,
        recommended_for=["chat", "analysis", "simple"],
        disable_thinking_default=False,
    ),
    "deepseek-v4-flash": ModelCompatConfig(
        provider="deepseek",
        model_id="deepseek-v4-flash",
        base_url="https://api.deepseek.com/anthropic",
        temperature_scale=1.0,
        supports_thinking=True,
        thinking_multiturn_ok=True,
        supports_document_block=True,
        supports_prompt_caching=True,
        supports_image=True,
        max_output_tokens=384000,
        recommended_for=["simple", "chat"],
        disable_thinking_default=True,  # 轻量模型默认不思考
    ),

    # --- Kimi K2 系列 ---
    "kimi-k2.6": ModelCompatConfig(
        provider="moonshot",
        model_id="kimi-k2.6",
        base_url="https://api.moonshot.ai/anthropic",
        temperature_scale=0.6,           # ⚠️ Kimi 内部缩放
        supports_thinking=True,
        thinking_multiturn_ok=False,     # ⚠️ 多轮工具调用中可能 400
        supports_document_block=False,   # ⚠️ document block 返回 400
        supports_prompt_caching=False,   # ⚠️ 不支持
        supports_image=True,
        max_output_tokens=32768,
        recommended_for=["analysis", "deep_research"],
        disable_thinking_default=True,   # ⚠️ 多轮场景必须关闭 thinking
    ),
    "kimi-k2.7-code": ModelCompatConfig(
        provider="moonshot",
        model_id="kimi-k2.7-code",
        base_url="https://api.moonshot.ai/anthropic",
        temperature_scale=0.6,
        supports_thinking=True,
        thinking_multiturn_ok=False,
        supports_document_block=False,
        supports_prompt_caching=False,
        supports_image=True,
        max_output_tokens=32768,
        recommended_for=["analysis", "deep_research"],
        disable_thinking_default=True,
    ),

    # --- GLM-4.5 ---
    "glm-4.5": ModelCompatConfig(
        provider="zhipu",
        model_id="glm-4.5",
        base_url="https://open.bigmodel.cn/api/anthropic",
        temperature_scale=1.0,
        supports_thinking=False,          # GLM 不支持 Anthropic thinking
        thinking_multiturn_ok=True,
        supports_document_block=True,
        supports_prompt_caching=False,
        supports_image=True,
        max_output_tokens=16384,
        recommended_for=["simple"],
        disable_thinking_default=True,
    ),
    "glm-4.5-air": ModelCompatConfig(
        provider="zhipu",
        model_id="glm-4.5-air",
        base_url="https://open.bigmodel.cn/api/anthropic",
        temperature_scale=1.0,
        supports_thinking=False,
        thinking_multiturn_ok=True,
        supports_document_block=True,
        supports_prompt_caching=False,
        supports_image=True,
        max_output_tokens=16384,
        recommended_for=["simple"],
        disable_thinking_default=True,
    ),
}


def get_model_config(model_id: str) -> ModelCompatConfig:
    """获取模型兼容性配置"""
    config = MODEL_REGISTRY.get(model_id)
    if config is None:
        # 未知模型：保守设置
        return ModelCompatConfig(
            provider="unknown",
            model_id=model_id,
            base_url="",
            temperature_scale=1.0,
            supports_thinking=False,
            thinking_multiturn_ok=True,
            supports_document_block=True,
            supports_prompt_caching=False,
            supports_image=True,
            disable_thinking_default=True,
        )
    return config


def get_recommended_model(task_type: str, prefer_provider: str = "deepseek") -> str:
    """根据任务类型推荐模型"""
    recommendations = {
        "chat": {"deepseek": "deepseek-v4-pro", "moonshot": "kimi-k2.6", "zhipu": "glm-4.5"},
        "analysis": {"deepseek": "deepseek-v4-pro", "moonshot": "kimi-k2.6", "zhipu": "glm-4.5"},
        "deep_research": {"deepseek": "deepseek-v4-pro", "moonshot": "kimi-k2.6", "zhipu": "glm-4.5"},
        "simple": {"deepseek": "deepseek-v4-flash", "moonshot": "kimi-k2.6", "zhipu": "glm-4.5-air"},
    }
    task_recs = recommendations.get(task_type, recommendations["chat"])
    return task_recs.get(prefer_provider, task_recs["deepseek"])
