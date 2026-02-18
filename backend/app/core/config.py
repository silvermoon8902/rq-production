from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "RQ. Performance"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rqos:rqos_secret@db:5432/rqos"
    DATABASE_URL_SYNC: str = "postgresql://rqos:rqos_secret@db:5432/rqos"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    SECRET_KEY: str = "change-this-in-production-use-a-real-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
