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
    app_instance: str = "local"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"
    production_enforce_secure_secrets: bool = True

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
    indexing_queue_name: str = "indexing"
    indexing_worker_job_timeout_seconds: int = 60 * 45
    indexing_worker_max_retries: int = 3
    indexing_worker_retry_backoff_seconds: str = "10,30,60"

    github_webhook_secret: str = ""
    billing_webhook_url: str = ""
    api_key_prefix: str = "tmk"
    secrets_mount_path: str = "./config/secrets"

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
    indexing_incremental_enabled: bool = True
    indexing_force_full_reindex: bool = False

    retrieval_rerank_enabled: bool = True
    retrieval_rerank_candidate_pool: int = 32
    retrieval_cache_ttl_seconds: int = 120
    retrieval_max_chunk_chars: int = 1400
    retrieval_context_char_budget: int = 12_000
    retrieval_min_token_overlap: int = 1

    jwt_secret_key: str = "change-me-in-production"
    jwt_issuer: str = "ai-codebase-copilot"
    jwt_access_token_expire_seconds: int = 60 * 60 * 8
    admin_registration_secret_key: str = ""

    plan_free_requests_per_day: int = 1500
    plan_free_queries_per_day: int = 200
    plan_free_queries_per_project_per_day: int = 120
    plan_free_index_jobs_per_day: int = 8
    plan_free_index_jobs_per_project_per_day: int = 5
    plan_free_indexing_volume_chunks_per_day: int = 40_000
    plan_free_max_projects: int = 3
    plan_free_max_repositories_per_project: int = 5

    plan_pro_requests_per_day: int = 15_000
    plan_pro_queries_per_day: int = 2_000
    plan_pro_queries_per_project_per_day: int = 1_200
    plan_pro_index_jobs_per_day: int = 60
    plan_pro_index_jobs_per_project_per_day: int = 30
    plan_pro_indexing_volume_chunks_per_day: int = 400_000
    plan_pro_max_projects: int = 25
    plan_pro_max_repositories_per_project: int = 40

    plan_enterprise_requests_per_day: int = 150_000
    plan_enterprise_queries_per_day: int = 20_000
    plan_enterprise_queries_per_project_per_day: int = 12_000
    plan_enterprise_index_jobs_per_day: int = 500
    plan_enterprise_index_jobs_per_project_per_day: int = 200
    plan_enterprise_indexing_volume_chunks_per_day: int = 4_000_000
    plan_enterprise_max_projects: int = 500
    plan_enterprise_max_repositories_per_project: int = 1_000

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

    @property
    def indexing_worker_retry_intervals(self) -> list[int]:
        raw = (self.indexing_worker_retry_backoff_seconds or "").strip()
        if not raw:
            return [10, 30, 60]
        values: list[int] = []
        for piece in raw.split(","):
            piece = piece.strip()
            if not piece:
                continue
            try:
                values.append(max(1, int(piece)))
            except ValueError:
                continue
        return values or [10, 30, 60]

    @property
    def is_production_like(self) -> bool:
        return str(self.app_env).strip().lower() in {"production", "staging"}

    def validate_runtime_configuration(self) -> None:
        if not self.production_enforce_secure_secrets or not self.is_production_like:
            return

        insecure_values = {
            "jwt_secret_key": self.jwt_secret_key,
            "postgres_password": self.postgres_password,
        }
        weak_markers = {"change-me-in-production", "mypassword", "password", "changeme", "default"}

        weak_fields = []
        for key, value in insecure_values.items():
            normalized = str(value or "").strip().lower()
            if not normalized or normalized in weak_markers:
                weak_fields.append(key)

        if weak_fields:
            joined = ", ".join(sorted(weak_fields))
            raise RuntimeError(f"Unsafe production configuration: {joined}")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
