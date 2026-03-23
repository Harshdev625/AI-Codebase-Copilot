from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Codebase Copilot API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    ollama_base_url: str = "http://localhost:11434"
    ollama_embedding_model: str = "mxbai-embed-large"
    ollama_chat_model: str = "qwen2.5-coder"
    ollama_timeout_seconds: float = 60.0

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "code_chunks"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_cache_ttl_seconds: int = 300

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "aicc"
    postgres_user: str = "postgres"
    postgres_password: str = "mypassword"

    vector_dim: int = 1024
    max_retrieval_k: int = 12
    repo_cache_dir: str = ".repo_cache"
    repo_cache_persist: bool = False
    max_index_file_size_bytes: int = 1_000_000

    jwt_secret_key: str = "change-me-in-production"
    jwt_issuer: str = "ai-codebase-copilot"
    jwt_access_token_expire_seconds: int = 60 * 60 * 8
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_full_name: str = "Administrator"

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
    def redis_dsn(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
