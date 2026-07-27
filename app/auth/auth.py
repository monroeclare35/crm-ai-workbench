"""
CRM AI 工作台 — 认证鉴权模块

OAuth 2.0 + SSO (飞书/企业微信)
生产环境对接企业内部统一认证；开发环境支持 Mock。
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.schemas import User, UserRole

security = HTTPBearer(auto_error=False)


# ============================================================
# Mock 用户（开发环境）
# ============================================================

MOCK_USERS: dict[str, User] = {
    "dev-sales-001": User(
        id="dev-sales-001",
        name="张三 (销售)",
        role=UserRole.SALES,
        department="华东区",
        permissions=["read:customer", "read:consumption"],
        managed_customers=["C001", "C002", "C003", "C004", "C005"],
    ),
    "dev-ops-001": User(
        id="dev-ops-001",
        name="李四 (运营)",
        role=UserRole.OPERATIONS,
        department="华东区",
        permissions=["read:customer", "read:consumption", "write:report", "send:message"],
        managed_customers=["C001", "C002", "C003", "C004", "C005", "C006", "C007"],
    ),
    "dev-manager-001": User(
        id="dev-manager-001",
        name="王五 (管理者)",
        role=UserRole.MANAGER,
        department="华东区",
        permissions=["read:customer", "read:consumption", "write:report", "send:message",
                     "manage:team", "cross_region_access"],
        managed_customers=["*"],  # 全部客户
    ),
    "dev-agent-001": User(
        id="dev-agent-001",
        name="赵六 (代理商)",
        role=UserRole.AGENT,
        department="华东区",
        permissions=["read:customer", "read:consumption", "read:knowledge"],
        managed_customers=["C001", "C002"],
    ),
    "dev-analyst-001": User(
        id="dev-analyst-001",
        name="孙七 (分析师)",
        role=UserRole.ANALYST,
        department="总部",
        permissions=["read:customer", "read:consumption", "write:report", "cross_region_access"],
        managed_customers=["*"],
    ),
}


# ============================================================
# 用户依赖注入
# ============================================================

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    x_user_id: Annotated[str | None, Header()] = None,
) -> User:
    """
    获取当前登录用户。

    生产环境：解析 JWT / OAuth token，查询用户服务。
    开发环境：从 Header (X-User-Id) 或 Bearer Token 获取 Mock 用户。
    """
    is_dev = os.environ.get("APP_ENV", "development") == "development"

    if is_dev:
        # 开发环境：优先 X-User-Id header，其次是 Bearer token
        user_id = x_user_id
        if not user_id and credentials:
            user_id = credentials.credentials
        if not user_id:
            user_id = "dev-sales-001"  # 默认

        user = MOCK_USERS.get(user_id)
        if not user:
            raise HTTPException(status_code=401, detail=f"开发用户不存在: {user_id}")
        return user

    # ---- 生产环境：真实认证逻辑 ----
    if not credentials:
        raise HTTPException(status_code=401, detail="需要认证")

    token = credentials.credentials
    # TODO: 接入飞书/企业微信 OAuth
    # user_info = await feishu_auth.verify_token(token)
    # user = await user_service.get_or_create(user_info)
    raise HTTPException(status_code=501, detail="生产认证逻辑待实现")


async def require_permission(permission: str, user: User = Depends(get_current_user)) -> User:
    """检查用户是否有指定权限"""
    if permission not in user.permissions and "*" not in user.permissions:
        raise HTTPException(status_code=403, detail=f"缺少权限: {permission}")
    return user


# ============================================================
# 数据权限检查
# ============================================================

class PermissionService:
    """数据权限服务——校验用户能否访问特定客户/数据"""

    async def can_access_customer(self, user_id: str, customer_id: str) -> bool:
        """检查用户是否有该客户的数据权限"""
        user = MOCK_USERS.get(user_id)
        if not user:
            return False
        # 管理员和分析师可以访问全部客户
        if "*" in user.managed_customers:
            return True
        return customer_id in user.managed_customers

    async def can_access_region(self, user_id: str, region: str) -> bool:
        """检查用户能否访问该区域的数据"""
        user = MOCK_USERS.get(user_id)
        if not user:
            return False
        if "cross_region_access" in user.permissions:
            return True
        return user.department == region


permission_service = PermissionService()
