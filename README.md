# 🚀 CRM AI 智能工作台

> One Smart Agent, Infinite Capabilities.
>
> 面向商业化销售、运营、管理角色的 AI Native 智能工作台。
> 基于 Claude Agent SDK 构建——不是硬编码工作流，而是一个真正能自主思考的 AI 大脑。

---

## 💡 产品简介

在商业化业务中，客户数据、广告知识、营销策略和任务流程分散在不同系统里。销售每天花 40% 时间在"查信息、找资料、写报告"上。

CRM AI 工作台用大模型重新定义这一切——用自然语言交互替代菜单点击，用 Agent 自主编排替代预设工作流，用 Memory 沉淀替代重复劳动。从"问题理解 → 数据查询 → 策略生成 → 行动建议"全链路 AI 驱动。

### 它能做什么

| 场景 | 你只需要说 | Agent 自主完成 |
|------|-----------|---------------|
| 🔍 查数据 | "华东区教育行业近30天消耗TOP10" | CRM多条件查询 → 聚合排序 → 结构化展示 |
| 💡 出策略 | "XX客户ROI下降，帮我分析原因给建议" | 查客户数据 → 拉消耗趋势 → 搜行业Benchmark → 多维度诊断 |
| 📋 写报告 | "生成本周华东区运营周报" | 查全部客户 → 逐客户分析 → 异常检测 → 生成Markdown → 飞书推送 |
| 🔬 深调研 | "教育行业2026广告投放趋势调研" | 任务分解 → 5个子Agent并行检索 → 交叉验证 → 报告合成 |
| ⏰ 晨间推送 | (每天8:00自动) | 查负责客户 → 识别异常 → 生成晨报 → 推送到飞书 |

### 架构哲学

```
用户自然语言
    ↓
Claude Agent SDK (大脑)    ← 自主决策每一步做什么
    ├── Bash/Write/Edit      ← 原生能力 = 无限灵活性 (逃生舱)
    ├── 6个 MCP Server       ← 业务工具 = 接入CRM/知识库/分析引擎
    └── 6个 Skill             ← 领域知识 = 教Agent怎么思考 (可执行SOP)
    ↓
结果: 查数 · 分析 · 策略 · 报告 · 推送 · 任务
```

和传统方案的本质区别: 没有预设的 DAG 工作流。Agent 不是提线木偶——它拥有 Bash 作为"逃生舱"，任何 MCP 工具做不到的事情，现场写 Python 脚本解决。

---

## 🛠 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| Agent 引擎 | Claude Agent SDK (Python) | 与 Claude Code 共享内核 |
| 大模型 | DeepSeek V4 Pro / Kimi K2.6 / GLM-4.5 | Anthropic 格式兼容，改 URL 即切换 |
| 后端 | FastAPI + SSE 流式 | 9 个 API 接口 |
| 前端 | 原生 HTML/CSS/JS SPA | 5 视图 (对话/看板/报告/客户/知识库) |
| 向量检索 | Milvus | 知识库 RAG + Memory 语义搜索 |
| 会话存储 | Redis | Session 多 worker 共享 |
| 容器化 | Docker Compose | 一键部署 (含 Redis/Milvus/etcd/MinIO) |

---

## 🚀 快速启动

```bash
# 1. 克隆
git clone https://github.com/monroeclare35/crm-ai-workbench.git
cd crm-ai-workbench

# 2. 配置
cp .env.example .env
# 编辑 .env 填入 API Key

# 3. 启动
docker-compose up -d

# 4. 访问
open http://localhost:8000
```

---

## 📁 项目结构

```
crm-ai-workbench/
├── app/
│   ├── agent_service.py       # 核心 Agent (Memory预注入 + Redis Session)
│   ├── model_compat.py        # 模型兼容性注册表
│   ├── session_store.py       # 分布式 Session (Redis)
│   ├── mcp_servers/           # 6个 MCP Server (11 tools)
│   ├── hooks/                 # PreToolUse 安全鉴权
│   ├── memory/                # 三层记忆存储
│   └── api/                   # FastAPI 路由
├── skills/                    # 6个 Skill (认知框架注入)
├── frontend/                  # 5视图 SPA 前端
├── tests/                     # 8 个 pytest
└── docs/                      # PRD + 技术架构 + 迭代记录
```

---

## 📚 文档

- [PRD + 技术架构文档 (v2.0)](docs/PRD-技术架构.md)
- [迭代记录 (9轮)](docs/ITERATION-LOG.md)
- [答辩材料 (PPT大纲 + Demo脚本)](PRESENTATION.md)
