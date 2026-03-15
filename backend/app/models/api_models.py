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


class ToolRequest(BaseModel):
    tool_name: Literal["read_file", "git_status", "run_command"]
    args: dict[str, Any] = Field(default_factory=dict)


class ToolResponse(BaseModel):
    success: bool
    output: str
