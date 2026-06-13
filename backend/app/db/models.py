from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.database import Base
from app.db.types import JSONBType, VectorType


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False, default="USER")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    repositories: Mapped[list["Repository"]] = relationship("Repository", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions: Mapped[list["ChatSession"]] = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------

class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    repo_id: Mapped[str] = mapped_column(String, nullable=False)
    remote_url: Mapped[str | None] = mapped_column(String, nullable=True)
    local_path: Mapped[str | None] = mapped_column(String, nullable=True)
    default_branch: Mapped[str] = mapped_column(String, nullable=False, default="main")

    # Tracks the most recently completed full index commit SHA
    latest_indexed_commit: Mapped[str | None] = mapped_column(String, nullable=True)

    # Snapshot retention policy:
    #   ALL         – keep every snapshot forever
    #   LAST_N      – keep the N most recent (plus pinned/release snapshots)
    #   IMPORTANT_ONLY – keep only pinned and release snapshots
    retain_snapshots_mode: Mapped[str] = mapped_column(String, nullable=False, default="LAST_N")
    retain_snapshot_count: Mapped[int] = mapped_column(Integer, nullable=False, default=20)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    owner: Mapped[User] = relationship("User", back_populates="repositories")
    code_chunks: Mapped[list["CodeChunk"]] = relationship("CodeChunk", back_populates="repository", cascade="all, delete-orphan")
    indexing_jobs: Mapped[list["IndexingJob"]] = relationship("IndexingJob", back_populates="repository", cascade="all, delete-orphan")
    chat_sessions: Mapped[list["ChatSession"]] = relationship("ChatSession", back_populates="repository", cascade="all, delete-orphan")
    repository_files: Mapped[list["RepositoryFile"]] = relationship("RepositoryFile", back_populates="repository", cascade="all, delete-orphan")
    snapshots: Mapped[list["RepositorySnapshot"]] = relationship("RepositorySnapshot", back_populates="repository", cascade="all, delete-orphan")
    context_entries: Mapped[list["RepositoryContextEntry"]] = relationship("RepositoryContextEntry", back_populates="repository", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_repositories_repo_id_lower", func.lower(repo_id)),
        UniqueConstraint("owner_user_id", "repo_id", name="uq_repositories_owner_repo"),
    )


# ---------------------------------------------------------------------------
# Repository File Tree
# ---------------------------------------------------------------------------

class RepositoryFile(Base):
    """
    Represents every file discovered during indexing (including skipped ones).
    Powers the File Explorer without disk access, and enables hash-based
    incremental re-indexing.
    """
    __tablename__ = "repository_files"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # 'FILE' | 'DIRECTORY'
    type: Mapped[str] = mapped_column(String, nullable=False, default="FILE")
    extension: Mapped[str | None] = mapped_column(String, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    line_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # sha256 of file content — used to skip re-embedding unchanged files
    hash: Mapped[str | None] = mapped_column(String, nullable=True)
    # True for generated/vendor files (node_modules, dist, lock files, etc.)
    is_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 'INDEXED' | 'SKIPPED' | 'ERROR'
    status: Mapped[str] = mapped_column(String, nullable=False, default="INDEXED", index=True)
    # 'FILE_TOO_LARGE' | 'UNSUPPORTED_EXTENSION' | 'BINARY_FILE' | 'IGNORED_BY_VCS' | 'LOW_SIGNAL'
    skip_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    last_indexed_commit: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    repository: Mapped["Repository"] = relationship("Repository", back_populates="repository_files")

    __table_args__ = (
        UniqueConstraint("repository_id", "path", name="uq_repository_files_repo_path"),
        Index("idx_repository_files_status", "repository_id", "status"),
        Index("idx_repository_files_language", "repository_id", "language"),
    )


# ---------------------------------------------------------------------------
# Repository Context Entries
# ---------------------------------------------------------------------------

class RepositoryContextEntry(Base):
    __tablename__ = "repository_context_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String, nullable=False)
    entry_type: Mapped[str] = mapped_column(String, nullable=False)  # 'FILE' | 'CHUNK'
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )

    repository: Mapped["Repository"] = relationship("Repository", back_populates="context_entries")


# ---------------------------------------------------------------------------
# Repository Snapshots
# ---------------------------------------------------------------------------

class RepositorySnapshot(Base):
    """
    Immutable record created on every successful indexing job completion.
    Pinned and release snapshots are never deleted by the retention policy.
    """
    __tablename__ = "repository_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String, nullable=False)
    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    files_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunks_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    files_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Retention: pinned snapshots are never deleted regardless of policy
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Retention: release snapshots are never deleted (can be set via webhook / API)
    is_release: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    # Phase 3B corrections
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="ACTIVE", default="ACTIVE")
    index_status: Mapped[str] = mapped_column(String, nullable=False, server_default="COMPLETE", default="COMPLETE")
    indexer_version: Mapped[str | None] = mapped_column(String, nullable=True)
    last_indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    repository: Mapped["Repository"] = relationship("Repository", back_populates="snapshots")
    snapshot_files: Mapped[list["SnapshotFile"]] = relationship("SnapshotFile", back_populates="snapshot", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("repository_id", "commit_sha", name="uq_repository_snapshots_repo_commit"),
    )


class SnapshotFile(Base):
    __tablename__ = "snapshot_files"

    snapshot_id: Mapped[str] = mapped_column(
        ForeignKey("repository_snapshots.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    path: Mapped[str] = mapped_column(String, primary_key=True)
    content_hash: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_type: Mapped[str] = mapped_column(String, nullable=False, default="FILE")
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    line_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    snapshot: Mapped["RepositorySnapshot"] = relationship("RepositorySnapshot", back_populates="snapshot_files")


class ActPatchDraft(Base):
    __tablename__ = "act_patch_drafts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_commit_sha: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="DRAFT")
    pre_apply_snapshot_id: Mapped[str | None] = mapped_column(
        ForeignKey("repository_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    post_apply_snapshot_id: Mapped[str | None] = mapped_column(
        ForeignKey("repository_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_by: Mapped[str | None] = mapped_column(String, nullable=True)
    applied_commit_sha_before: Mapped[str | None] = mapped_column(String, nullable=True)
    validation_logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )

    repository: Mapped["Repository"] = relationship("Repository")
    patch_files: Mapped[list["ActPatchFile"]] = relationship(
        "ActPatchFile", back_populates="patch", cascade="all, delete-orphan"
    )
    patch_chunks: Mapped[list["PatchChunk"]] = relationship(
        "PatchChunk", back_populates="patch", cascade="all, delete-orphan"
    )


class ActPatchFile(Base):
    __tablename__ = "act_patch_files"

    patch_id: Mapped[str] = mapped_column(
        ForeignKey("act_patch_drafts.id", ondelete="CASCADE"), primary_key=True
    )
    file_path: Mapped[str] = mapped_column(String, primary_key=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    file_diff: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash_before: Mapped[str | None] = mapped_column(String, nullable=True)
    content_hash_after: Mapped[str | None] = mapped_column(String, nullable=True)

    patch: Mapped["ActPatchDraft"] = relationship("ActPatchDraft", back_populates="patch_files")


class PatchChunk(Base):
    __tablename__ = "patch_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    patch_id: Mapped[str] = mapped_column(
        ForeignKey("act_patch_drafts.id", ondelete="CASCADE"), index=True
    )
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    repo_id: Mapped[str] = mapped_column(String, nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    symbol: Mapped[str] = mapped_column(String, nullable=False, default="")
    language: Mapped[str] = mapped_column(String, nullable=False, default="")
    chunk_type: Mapped[str] = mapped_column(String, nullable=False, default="generic")
    start_line: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    qdrant_point_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )

    patch: Mapped["ActPatchDraft"] = relationship("ActPatchDraft", back_populates="patch_chunks")
    repository: Mapped["Repository"] = relationship("Repository")



from sqlalchemy import event
from sqlalchemy.orm.attributes import get_history

@event.listens_for(RepositorySnapshot, "before_update")
def prevent_snapshot_updates(mapper, connection, target):
    for attr in ["commit_sha", "files_count", "chunks_count"]:
        history = get_history(target, attr)
        if history.has_changes():
            raise ValueError(f"RepositorySnapshot is immutable. Column '{attr}' cannot be updated.")


# ---------------------------------------------------------------------------
# Indexing Jobs  (extended)
# ---------------------------------------------------------------------------

class IndexingJob(Base):
    __tablename__ = "indexing_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued", index=True)
    message: Mapped[str | None] = mapped_column(String, nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String, nullable=True)

    # New: queue metadata
    # 'MANUAL' | 'GIT_PULL' | 'ACT_PATCH' | 'SCHEDULED'
    trigger_type: Mapped[str] = mapped_column(String, nullable=False, default="MANUAL")
    # 1 (highest priority) to 10 (lowest). ACT_PATCH = 1, SCHEDULED = 9
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    # New: outcome counters for Repository Insights
    files_indexed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    files_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunks_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Array of per-file errors: [{file, error, timestamp}]
    errors: Mapped[list[Any]] = mapped_column(JSONBType(), nullable=False, default=list)

    # Progress blob (percentage, stage, ETA, etc.)
    stats: Mapped[dict[str, Any]] = mapped_column(JSONBType(), nullable=False, default=dict)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    repository: Mapped["Repository"] = relationship("Repository", back_populates="indexing_jobs")


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repository_id: Mapped[str | None] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Frozen to the commit SHA that was active when the session was created
    commit_sha: Mapped[str | None] = mapped_column(String, nullable=True)
    session_title: Mapped[str | None] = mapped_column(String, nullable=True)
    session_mode: Mapped[str] = mapped_column(String, nullable=False, server_default="ASK")
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    session_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONBType(), nullable=False, default=dict
    )

    user: Mapped["User"] = relationship("User", back_populates="chat_sessions")
    repository: Mapped["Repository"] = relationship("Repository", back_populates="chat_sessions")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="chat_session", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chat_session_id: Mapped[str] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    msg_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONBType(), nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    chat_session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


# ---------------------------------------------------------------------------
# Agent Runs
# ---------------------------------------------------------------------------

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    repository_id: Mapped[str | None] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    diagnostics: Mapped[dict[str, Any]] = mapped_column(JSONBType(), nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Code Chunks  (embedding ownership moved to Qdrant)
# ---------------------------------------------------------------------------

class CodeChunk(Base):
    __tablename__ = "code_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    repo_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    snapshot_id: Mapped[str | None] = mapped_column(
        ForeignKey("repository_snapshots.id", ondelete="SET NULL"), nullable=True, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String, nullable=False, default="local")
    path: Mapped[str] = mapped_column(String, nullable=False, index=True)
    language: Mapped[str] = mapped_column(String, nullable=False, default="", index=True)
    symbol: Mapped[str] = mapped_column(String, nullable=False, default="")
    chunk_type: Mapped[str] = mapped_column(String, nullable=False, default="generic")
    start_line: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 'ACTIVE' | 'OBSOLETE' | 'PURGED'
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="ACTIVE", index=True)
    # sha256(content) — skip re-embed if unchanged
    content_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    # Reference into the Qdrant collection — Qdrant is the embedding system of record
    qdrant_point_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    obsolete_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Legacy embedding column kept for SQLite/offline fallback only
    # In Postgres deployments Qdrant is the source of truth
    msg_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONBType(), nullable=False, default=dict)
    embedding: Mapped[list[float] | None] = mapped_column(VectorType(settings.vector_dim), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())

    repository: Mapped["Repository"] = relationship("Repository", back_populates="code_chunks")

    __table_args__ = (
        Index("idx_code_chunks_repo_path", "repository_id", "path"),
        Index("idx_code_chunks_commit", "repository_id", "commit_sha"),
    )
