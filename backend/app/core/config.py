from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os
import json


class Settings(BaseSettings):
    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "PAD API"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://pad_user:password@localhost:5432/pad_db"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # AI
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = []

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse BACKEND_CORS_ORIGINS from environment variable
        # Supports both JSON array format and comma-separated format
        cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://localhost:8000")

        try:
            # Try parsing as JSON array first (Railway format)
            self.BACKEND_CORS_ORIGINS = json.loads(cors_origins)
        except (json.JSONDecodeError, TypeError):
            # Fallback to comma-separated format
            self.BACKEND_CORS_ORIGINS = [origin.strip() for origin in cors_origins.split(",")]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 100

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignora variables de entorno extra
    )


settings = Settings()
