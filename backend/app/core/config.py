from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
_BACKEND_ROOT = _BACKEND_ENV_FILE.parent


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
    log_format: str = "text"  # "text" or "json" (PHASE 2: structured logging)
    production_enforce_secure_secrets: bool = True

    cors_allow_origins: str = "http://localhost:3000"  # env: CORS_ALLOW_ORIGINS
    cors_allow_methods: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    cors_allow_headers: str = "Authorization,Content-Type,X-Request-Id"

    rate_limit_requests_per_window: int = 120
    rate_limit_window_seconds: int = 60
    rate_limit_exempt_paths: str = "/docs,/openapi.json,/redoc,/health"

    ollama_base_url: str = "http://localhost:11434"
    ollama_embedding_model: str = "mxbai-embed-large:latest"
    ollama_chat_model: str = "tinyllama:latest"
    ollama_timeout_seconds: float = 600.0
    ollama_chat_timeout_seconds: float = 15.0
    ollama_embedding_timeout_seconds: float = 600.0

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

    secrets_mount_path: str = "./config/secrets"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "aicc"
    postgres_user: str = "postgres"
    postgres_password: str = "mypassword"

    database_url: str | None = None

    postgres_pool_size: int = 5
    postgres_max_overflow: int = 10
    postgres_pool_timeout_seconds: int = 30

    vector_dim: int = 768
    max_retrieval_k: int = 12
    repo_cache_dir: str = ".repo_cache"
    # When True, remote clones are NOT deleted after indexing (required for File Explorer
    # and ACT mode). Set False only in CI / resource-constrained environments.
    repo_cache_persist: bool = True
    max_index_file_size_bytes: int = 1_000_000
    indexing_timeout_seconds: int = 60 * 30
    indexing_stall_timeout_seconds: int = 60 * 5
    indexing_pending_timeout_seconds: int = 60 * 2
    indexing_local_fallback_enabled: bool = True
    indexing_incremental_enabled: bool = True
    indexing_force_full_reindex: bool = False

    # Snapshot retention defaults (overridden per-repository via DB)
    # ALL | LAST_N | IMPORTANT_ONLY
    default_retain_snapshots_mode: str = "LAST_N"
    default_retain_snapshot_count: int = 20
    # How often the background retention cleanup runs (seconds)
    snapshot_retention_interval_seconds: int = 60 * 60  # 1 hour

    retrieval_rerank_enabled: bool = True
    retrieval_rerank_candidate_pool: int = 32
    retrieval_cache_ttl_seconds: int = 120
    retrieval_max_chunk_chars: int = 1400
    retrieval_context_char_budget: int = 7_000
    retrieval_min_token_overlap: int = 1

    jwt_secret_key: str = "change-me-in-production"
    jwt_issuer: str = "ai-codebase-copilot"
    jwt_access_token_expire_seconds: int = 60 * 60 * 8
    admin_registration_secret_key: str = ""

    # NOTE: SaaS limits/billing intentionally removed in Phase 3.

    @property
    def repo_cache_path(self) -> str:
        """Absolute on-disk directory for cloned repositories."""
        cache = Path(self.repo_cache_dir)
        if cache.is_absolute():
            return str(cache.resolve())
        return str((_BACKEND_ROOT / cache).resolve())

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
        """Comprehensive startup configuration validation."""
        from urllib.parse import urlparse
        import logging

        logger_local = logging.getLogger(__name__)

        # Always warn on obviously-weak JWT secret regardless of environment.
        weak_markers = {"change-me-in-production", "mypassword", "password", "changeme", "default", "secret", ""}
        jwt_normalized = str(self.jwt_secret_key or "").strip().lower()
        if jwt_normalized in weak_markers or len(str(self.jwt_secret_key or "")) < 32:
            if self.is_production_like:
                raise RuntimeError(
                    "JWT_SECRET_KEY is weak or too short. "
                    "Set a random 64-char secret in your .env file before deploying."
                )
            logger_local.warning(
                "config_validation - JWT_SECRET_KEY is weak (length=%d). "
                "Set a strong secret before deploying to production.",
                len(str(self.jwt_secret_key or "")),
            )

        if not self.production_enforce_secure_secrets or not self.is_production_like:
            logger_local.debug("config_validation - skipped deep checks (not production-like)")
            return

        # Deep production checks
        insecure_values = {
            "postgres_password": self.postgres_password,
        }
        pg_weak = {"mypassword", "password", "changeme", "default", "postgres", ""}
        weak_fields = []
        for key, value in insecure_values.items():
            normalized = str(value or "").strip().lower()
            if normalized in pg_weak:
                weak_fields.append(key)

        if weak_fields:
            joined = ", ".join(sorted(weak_fields))
            raise RuntimeError(f"Unsafe production configuration: {joined}")

        # Validate CORS is not still pointing at localhost in production
        if "localhost" in self.cors_allow_origins and "localhost" not in (self.app_host or ""):
            logger_local.warning(
                "config_validation - CORS_ALLOW_ORIGINS still set to localhost. "
                "Update CORS_ALLOW_ORIGINS in .env to your production domain."
            )
        
        # H3: Validate external service URLs
        try:
            parsed = urlparse(self.ollama_base_url)
            if not parsed.scheme or not parsed.netloc:
                raise RuntimeError(f"Invalid ollama_base_url: {self.ollama_base_url}")
        except Exception as exc:
            raise RuntimeError(f"Invalid ollama_base_url: {exc}") from exc
        
        # H3: Validate Qdrant configuration
        if not self.qdrant_host or not self.qdrant_host.strip():
            raise RuntimeError("qdrant_host cannot be empty")
        if self.qdrant_port <= 0 or self.qdrant_port > 65535:
            raise RuntimeError(f"qdrant_port out of range: {self.qdrant_port}")
        
        # H3: Validate database configuration
        if self.postgres_pool_size <= 0:
            raise RuntimeError(f"postgres_pool_size must be > 0: {self.postgres_pool_size}")
        if self.postgres_max_overflow < 0:
            raise RuntimeError(f"postgres_max_overflow cannot be negative: {self.postgres_max_overflow}")
        
        # H3: Validate vector dimension matches embedding model expectations
        if self.vector_dim <= 0:
            raise RuntimeError(f"vector_dim must be > 0: {self.vector_dim}")
        if self.vector_dim > 4096:
            raise RuntimeError(f"vector_dim suspiciously large: {self.vector_dim}")
        
        logger_local.info("config_validation - all checks passed")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
