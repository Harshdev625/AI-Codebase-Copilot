from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", _BACKEND_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AI Codebase Copilot API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    cors_allow_origins: str = "http://localhost:3000"
    cors_allow_methods: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    cors_allow_headers: str = "Authorization,Content-Type,X-Request-Id"

    rate_limit_requests_per_window: int = 120
    rate_limit_window_seconds: int = 60
    rate_limit_exempt_paths: str = "/docs,/openapi.json,/redoc,/health"

    ollama_base_url: str = "http://localhost:11434"
    ollama_embedding_model: str = "mxbai-embed-large:latest"
    ollama_chat_model: str = "tinyllama:latest"
    ollama_timeout_seconds: float = 600.0

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "code_chunks"
    qdrant_timeout_seconds: float = 30.0

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_cache_ttl_seconds: int = 300

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "aicc"
    postgres_user: str = "postgres"
    postgres_password: str = "mypassword"

    postgres_pool_size: int = 5
    postgres_max_overflow: int = 10
    postgres_pool_timeout_seconds: int = 30

    vector_dim: int = 768
    max_retrieval_k: int = 12
    repo_cache_dir: str = ".repo_cache"
    repo_cache_persist: bool = False
    max_index_file_size_bytes: int = 1_000_000
    indexing_timeout_seconds: int = 60 * 30
    indexing_stall_timeout_seconds: int = 60 * 5

    jwt_secret_key: str = "change-me-in-production"
    jwt_issuer: str = "ai-codebase-copilot"
    jwt_access_token_expire_seconds: int = 60 * 60 * 8
    admin_registration_secret_key: str = ""

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    @property
    def cors_allow_origins_list(self) -> list[str]:
        raw = (self.cors_allow_origins or "").strip()
        if not raw:
            return []
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def cors_allow_methods_list(self) -> list[str]:
        raw = (self.cors_allow_methods or "").strip()
        if not raw:
            return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
        return [method.strip().upper() for method in raw.split(",") if method.strip()]

    @property
    def cors_allow_headers_list(self) -> list[str]:
        raw = (self.cors_allow_headers or "").strip()
        if not raw:
            return ["Authorization", "Content-Type", "X-Request-Id"]
        return [header.strip() for header in raw.split(",") if header.strip()]

    @property
    def rate_limit_exempt_paths_list(self) -> list[str]:
        raw = (self.rate_limit_exempt_paths or "").strip()
        if not raw:
            return []
        return [path.strip() for path in raw.split(",") if path.strip()]

    @property
    def redis_dsn(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
