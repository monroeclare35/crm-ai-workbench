# CRM AI 工作台

## 快速启动

```bash
# 1. 安装依赖
pip install -e ".[dev]"

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实 API Key

# 3. 启动开发服务器
uvicorn app.main:app --reload --port 8000

# 4. 访问
open http://localhost:8000
open http://localhost:8000/docs  # Swagger API 文档
```

## 项目结构

```
crm-ai-workbench/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── agent_service.py     # 核心 Agent 服务
│   ├── api/                 # API 路由
│   ├── mcp_servers/         # MCP Server 定义
│   ├── hooks/               # 安全 Hook
│   ├── memory/              # Memory 存储
│   ├── auth/                # 认证鉴权
│   └── models/              # Pydantic 模型
├── skills/                  # Skill 技能定义
│   ├── customer-analysis/
│   ├── ad-strategy/
│   ├── sales-process/
│   ├── report-generation/
│   ├── data-query/
│   └── deep-research/
├── frontend/                # 前端工作台
├── tests/                   # 测试
├── .mcp.json                # MCP 配置
└── pyproject.toml
```

## 核心架构

**One Smart Agent** — 单一 Agent 大脑，按需调用 MCP 工具 + 加载 Skill 技能，彻底告别硬编码工作流。

```
用户自然语言 → Claude Agent SDK → 自主规划 → 调用工具 → 返回结果
                                    ↓
                    MCP Tools (手) + Skills (脑) + Memory (经验)
```

## 模型

默认使用 Kimi K2（Anthropic 兼容端点）。也支持 DeepSeek / GLM / Qwen，修改 `.env` 中的 `ANTHROPIC_BASE_URL` 即可切换。
