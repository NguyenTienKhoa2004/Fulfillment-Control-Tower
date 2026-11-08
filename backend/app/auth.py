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
        raise HTTPException(401, "Sign in is required.", headers={"WWW-Authenticate": "Bearer"})
    url = get_settings().supabase_url.rstrip("/")
    if not url:
        raise HTTPException(503, "SUPABASE_URL is not configured.")
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
        raise HTTPException(503, "Unable to reach the authentication server. Please try again later.") from exc
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise HTTPException(
            401, "Invalid token.", headers={"WWW-Authenticate": "Bearer"}
        ) from exc
    profile = db.get(Profile, profile_id)
    if profile is None or not profile.active:
        raise HTTPException(403, "This account does not have an active profile.")
    if profile.role == Role.STORE_STAFF and not profile.store_code:
        raise HTTPException(403, "This account is not assigned to a store.")
    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


def require_logistics(profile: CurrentProfile) -> Profile:
    if profile.role != Role.LOGISTICS_COORDINATOR:
        raise HTTPException(403, "Only logistics coordinators can perform this action.")
    return profile
