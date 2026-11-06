from functools import lru_cache
from pathlib import Path
from uuid import UUID

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore"
    )

    database_url: str = "postgresql+psycopg://netcom:netcom_local@localhost:5432/netcom"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    frontend_origin: str = "http://localhost:5173"
    demo_logistics_auth_id: str = ""
    demo_store_auth_id: str = ""
    risk_data_max_age_minutes: int = Field(default=60, gt=0)
    handover_warning_minutes: int = Field(default=120, gt=0)

    def demo_profile_ids(self) -> tuple[UUID | None, UUID | None]:
        return (
            UUID(self.demo_logistics_auth_id) if self.demo_logistics_auth_id else None,
            UUID(self.demo_store_auth_id) if self.demo_store_auth_id else None,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
