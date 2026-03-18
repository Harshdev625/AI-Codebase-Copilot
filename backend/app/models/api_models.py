from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ChatRequest(BaseModel):
    repo_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=3)


class ChatResponse(BaseModel):
    answer: str
    intent: str
    sources: list[dict[str, Any]] = []


class SearchRequest(BaseModel):
    repo_id: str
    query: str
    top_k: int = Field(default=8, ge=1, le=50)


class SearchResponse(BaseModel):
    results: list[dict[str, Any]]


class IndexRequest(BaseModel):
    repo_id: str
    repo_path: str | None = None
    repo_url: str | None = None
    repo_ref: str | None = None
    commit_sha: str = "local-working-copy"

    @model_validator(mode="after")
    def validate_source(self) -> "IndexRequest":
        if not self.repo_path and not self.repo_url:
            raise ValueError("Provide either repo_path or repo_url")
        return self


class IndexResponse(BaseModel):
    indexed_chunks: int
    status: Literal["ok"] = "ok"
    snapshot_id: str | None = None


class ToolRequest(BaseModel):
    tool_name: Literal["read_file", "git_status", "run_command"]
    args: dict[str, Any] = Field(default_factory=dict)


class ToolResponse(BaseModel):
    success: bool
    output: str


class AuthRegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    full_name: str | None = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: str
    is_active: bool


class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=2)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_by: str
    created_at: str


class AddRepositoryRequest(BaseModel):
    repo_id: str = Field(..., min_length=2)
    remote_url: str | None = None
    local_path: str | None = None
    default_branch: str = "main"

    @model_validator(mode="after")
    def validate_source(self) -> "AddRepositoryRequest":
        if not self.remote_url and not self.local_path:
            raise ValueError("Provide either remote_url or local_path")
        return self


class RepositoryResponse(BaseModel):
    id: str
    project_id: str
    repo_id: str
    remote_url: str | None = None
    local_path: str | None = None
    default_branch: str
    created_at: str


class CreateConversationRequest(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    title: str | None = None
    created_at: str


class MessageCreateRequest(BaseModel):
    repo_id: str
    query: str = Field(..., min_length=3)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: str
