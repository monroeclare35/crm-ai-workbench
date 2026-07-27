# CRM AI 工作台 Docker 部署

FROM python:3.12-slim

WORKDIR /app

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

# 应用代码
COPY app/ ./app/
COPY skills/ ./skills/
COPY scripts/ ./scripts/
COPY .mcp.json .

# 前端
COPY frontend/ ./frontend/

# 创建非 root 用户
RUN useradd -m -u 1000 agent && chown -R agent:agent /app
USER agent

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
