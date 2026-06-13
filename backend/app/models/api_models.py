from typing import Any, Literal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
# Accept either a single slug (e.g. "my-repo") or a GitHub-style owner/repo key.
# Deliberately disallow multiple '/' to avoid path-like identifiers.
REPO_ID_PATTERN = r"^(?:[A-Za-z0-9][A-Za-z0-9._-]{1,127}|[A-Za-z0-9][A-Za-z0-9._-]{0,63}/[A-Za-z0-9][A-Za-z0-9._-]{0,63})$"
BRANCH_PATTERN = r"^[A-Za-z0-9._/-]{1,128}$"
COMMIT_PATTERN = r"^[A-Za-z0-9._/-]{3,80}$"
UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
SCOPE_PATTERN = r"^[a-z*]+:[a-z*]+$"


class ChatMode(str, Enum):
    """Chat workflow modes."""
    QUESTION = "question"
    REFACTOR = "refactor"
    DEBUG = "debug"
    DOCUMENTATION = "documentation"
    TOOL = "tool"
    ASK = "ASK"
    PLAN = "PLAN"
    ACT = "ACT"


class StrictRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ChatRequest(StrictRequestModel):
    repository_id: str | None = Field(default=None, pattern=UUID_PATTERN)
    repo_id: str | None = Field(default=None, min_length=2, max_length=128, pattern=REPO_ID_PATTERN)
    query: str = Field(..., min_length=3, max_length=4000)
    session_id: str | None = Field(default=None, pattern=UUID_PATTERN)
    mode: ChatMode = Field(default=ChatMode.QUESTION, description="Chat workflow mode")
    include_patch: bool = Field(default=False, description="Include code patches in refactor mode")
    scope_paths: list[str] | None = Field(default=None, description="Paths to restrict retrieval scope")

    @model_validator(mode="after")
    def normalize_repo_id(self) -> "ChatRequest":
        has_repository = bool(self.repository_id) or bool(self.repo_id)
        if not has_repository:
            raise ValueError("Provide one of repository_id/repo_id")
        if bool(self.repository_id) and bool(self.repo_id):
            raise ValueError("Provide exactly one of repository_id or repo_id")
        if self.repo_id is not None:
            self.repo_id = _normalize_repo_id(self.repo_id)
        return self


class ChatResponse(BaseModel):
    answer: str
    intent: str
    session_id: str
    sources: list[dict[str, Any]] = []


class ApplyPatchRequest(StrictRequestModel):
    repository_id: str | None = Field(default=None, pattern=UUID_PATTERN)
    repo_id: str | None = Field(default=None, min_length=2, max_length=128, pattern=REPO_ID_PATTERN)
    diff: str = Field(..., description="The Unified Diff string to apply")

    @model_validator(mode="after")
    def normalize_repo_id(self) -> "ApplyPatchRequest":
        has_repository = bool(self.repository_id) or bool(self.repo_id)
        if not has_repository:
            raise ValueError("Provide one of repository_id/repo_id")
        if bool(self.repository_id) and bool(self.repo_id):
            raise ValueError("Provide exactly one of repository_id or repo_id")
        if self.repo_id is not None:
            self.repo_id = _normalize_repo_id(self.repo_id)
        return self


class ChatSessionResponse(BaseModel):
    id: str
    repository_id: str | None = None
    session_title: str | None = None
    session_mode: str
    is_pinned: bool
    is_archived: bool
    summary: str | None = None
    created_at: str
    updated_at: str
    last_activity_at: str
    metadata: dict[str, Any] | None = None


class ChatSessionUpdateRequest(StrictRequestModel):
    session_title: str | None = None
    is_pinned: bool | None = None
    is_archived: bool | None = None
    metadata: dict[str, Any] | None = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    metadata: dict[str, Any] = {}
    created_at: str


class IndexRequest(StrictRequestModel):
    repository_id: str | None = Field(default=None, pattern=UUID_PATTERN)
    repo_id: str | None = Field(default=None, min_length=2, max_length=128, pattern=REPO_ID_PATTERN)
    repo_path: str | None = Field(default=None, max_length=1024)
    repo_url: str | None = Field(default=None, max_length=1024)
    repo_ref: str | None = Field(default=None, max_length=128, pattern=BRANCH_PATTERN)
    commit_sha: str = Field(default="local-working-copy", min_length=3, max_length=80, pattern=COMMIT_PATTERN)
    full_reindex: bool = Field(
        default=False,
        description="When true, wipe remote clone cache and rebuild index from scratch.",
    )

    @model_validator(mode="after")
    def normalize_repo_id(self) -> "IndexRequest":
        if bool(self.repository_id) == bool(self.repo_id):
            raise ValueError("Provide exactly one of repository_id or repo_id")
        if self.repo_id is not None:
            self.repo_id = _normalize_repo_id(self.repo_id)
        return self


class IndexResponse(BaseModel):
    indexed_chunks: int
    status: Literal["ok"] = "ok"
    indexing_job_id: str | None = None


class ContextTokensRequest(StrictRequestModel):
    scope_paths: list[str] = []
    attached_files: list[str] = []
    retrieval_query: str | None = None
    session_id: str | None = None


class AuthRegisterRequest(StrictRequestModel):
    email: str = Field(..., max_length=320, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=8, max_length=256)
    full_name: str | None = Field(default=None, max_length=120)


class AuthAdminRegisterRequest(StrictRequestModel):
    email: str = Field(..., max_length=320, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=8, max_length=256)
    full_name: str | None = Field(default=None, max_length=120)
    admin_secret_key: str = Field(..., min_length=1, max_length=256)


class AuthLoginRequest(StrictRequestModel):
    email: str = Field(..., max_length=320, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=1, max_length=256)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: str
    token_scopes: list[str] = []
    is_active: bool


class CreateProjectRequest(StrictRequestModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_by: str
    created_at: str


class AddRepositoryRequest(StrictRequestModel):
    repo_id: str = Field(..., min_length=2, max_length=128, pattern=REPO_ID_PATTERN)
    remote_url: str | None = Field(default=None, max_length=1024)
    local_path: str | None = Field(default=None, max_length=1024)
    default_branch: str = Field(default="main", min_length=1, max_length=128, pattern=BRANCH_PATTERN)

    @model_validator(mode="after")
    def validate_source(self) -> "AddRepositoryRequest":
        self.repo_id = _normalize_repo_id(self.repo_id)
        if not self.remote_url and not self.local_path:
            raise ValueError("Provide either remote_url or local_path")
        if self.remote_url:
            normalized_url = str(self.remote_url).strip().lower()
            if not (
                normalized_url.startswith("https://")
                or normalized_url.startswith("http://")
                or normalized_url.startswith("git@")
                or normalized_url.startswith("ssh://")
            ):
                raise ValueError("remote_url must use https/http/ssh/git format")
        if self.local_path:
            normalized_path = str(self.local_path).strip().replace("\\", "/")
            if ".." in normalized_path.split("/"):
                raise ValueError("local_path must not contain parent traversal segments")
        return self


def _normalize_repo_id(repo_id: str) -> str:
    value = (repo_id or "").strip()
    if value.lower().endswith(".git"):
        value = value[:-4]
    value = value.strip("/")
    value = value.lower()

    # Reject path traversal or accidental path-like strings.
    if "//" in value:
        raise ValueError("repo_id must not contain '//'" )
    parts = value.split("/")
    if any(part in {".", "..", ""} for part in parts):
        raise ValueError("repo_id must not contain '.' or '..' segments")
    if len(parts) > 2:
        raise ValueError("repo_id must be a single slug or 'owner/repo'")
    return value


class RepositoryResponse(BaseModel):
    id: str
    owner_user_id: str | None = None
    repo_id: str
    remote_url: str | None = None
    local_path: str | None = None
    default_branch: str
    latest_indexed_commit: str | None = None
    retain_snapshots_mode: str = "LAST_N"
    retain_snapshot_count: int = 20
    created_at: str
    latest_job_status: str | None = None
    latest_job_stats: dict[str, Any] | None = None


class SnapshotResponse(BaseModel):
    id: str
    repository_id: str
    commit_sha: str
    indexed_at: str
    files_count: int
    chunks_count: int
    files_skipped: int
    is_pinned: bool
    is_release: bool


class SnapshotUpdateRequest(BaseModel):
    is_pinned: bool | None = None
    is_release: bool | None = None
    status: str | None = None


class RepositoryFileResponse(BaseModel):
    id: str
    path: str
    type: str
    extension: str | None = None
    language: str | None = None
    size_bytes: int | None = None
    line_count: int | None = None
    token_count: int | None = None
    is_generated: bool
    status: str
    skip_reason: str | None = None
    last_indexed_commit: str | None = None
