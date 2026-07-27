"""
CRM AI 工作台 — FastAPI 入口

核心路由：
  POST /api/v1/chat/stream    SSE 流式对话
  POST /api/v1/chat/sync      同步对话
  POST /api/v1/deep-research   深度调研
  GET  /api/v1/research/{id}/status  调研状态
  GET  /api/v1/health          健康检查
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.chat import router as chat_router
from app.api.research import router as research_router
from app.api.memory_api import router as memory_router
from app.models.schemas import UserRole


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # 启动时
    print("🚀 CRM AI 工作台启动中...")
    print(f"   模型: {os.environ.get('ANTHROPIC_MODEL', 'deepseek-chat')}")
    print(f"   端点: {os.environ.get('ANTHROPIC_BASE_URL', 'https://api.deepseek.com/anthropic')}")
    yield
    # 关闭时
    print("👋 CRM AI 工作台关闭")


app = FastAPI(
    title="CRM AI 智能工作台",
    description="面向商业化内部销售、运营、管理角色的 AI Native 智能工作台",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
app.include_router(chat_router, prefix="/api/v1")
app.include_router(research_router, prefix="/api/v1")
app.include_router(memory_router, prefix="/api/v1")

# 前端静态文件（生产环境）
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


# ============================================================
# 基础路由
# ============================================================

@app.get("/api/v1/health")
async def health():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "crm-ai-workbench",
        "version": "0.3.0",
        "model": os.environ.get("ANTHROPIC_MODEL", "deepseek-chat"),
    }


@app.get("/")
async def index():
    """前端入口"""
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "CRM AI 工作台 API 服务运行中。前端文件未找到，请访问 /docs 查看 API 文档。"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
