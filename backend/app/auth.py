from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Profile, Role

bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", lifespan=300, timeout=5)


def get_current_profile(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> Profile:
    if credentials is None:
        raise HTTPException(401, "Cần đăng nhập.", headers={"WWW-Authenticate": "Bearer"})
    url = get_settings().supabase_url.rstrip("/")
    if not url:
        raise HTTPException(503, "Chưa cấu hình SUPABASE_URL.")
    try:
        key = get_jwks_client(url).get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{url}/auth/v1",
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        profile_id = UUID(claims["sub"])
    except jwt.PyJWKClientConnectionError as exc:
        raise HTTPException(503, "Không thể kết nối máy chủ xác thực; thử lại sau.") from exc
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise HTTPException(
            401, "Token không hợp lệ.", headers={"WWW-Authenticate": "Bearer"}
        ) from exc
    profile = db.get(Profile, profile_id)
    if profile is None or not profile.active:
        raise HTTPException(403, "Tài khoản chưa có profile hoạt động.")
    if profile.role == Role.STORE_STAFF and not profile.store_code:
        raise HTTPException(403, "Tài khoản chưa được gán cửa hàng.")
    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


def require_logistics(profile: CurrentProfile) -> Profile:
    if profile.role != Role.LOGISTICS_COORDINATOR:
        raise HTTPException(403, "Chỉ logistics được thực hiện thao tác này.")
    return profile
