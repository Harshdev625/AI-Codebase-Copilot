import pytest
import uuid
from pathlib import Path
from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern
from sqlalchemy import text

from app.services.indexing_helpers import upsert_file_records
from app.api.v1.repositories.service import get_repository_insights, add_repository_for_user

@pytest.mark.asyncio
async def test_secret_file_heuristics(db_session, test_user, tmp_path):
    repo_id = "test-repo-insights"
    # Create repository in DB
    repo = add_repository_for_user(
        db_session,
        owner_user_id=test_user["id"],
        repo_id=repo_id,
        remote_url=None,
        local_path=str(tmp_path),
        default_branch="main"
    )
    
    # Create test files
    f_env = tmp_path / ".env"
    f_env.write_text("API_KEY=secret_value")
    
    f_secrets = tmp_path / "secrets.yml"
    f_secrets.write_text("password: 123")
    
    f_key = tmp_path / "private.key"
    f_key.write_text("-----BEGIN RSA PRIVATE KEY-----")
    
    # Run upsert_file_records
    await upsert_file_records(
        db_session,
        repository_id=repo["id"],
        repo_root=tmp_path,
        commit_sha="commit-sha-1",
        file_list=[f_env, f_secrets, f_key]
    )
    
    # Query database and verify they are classified as SECRET_FILE
    rows = db_session.execute(
        text("SELECT path, skip_reason, status FROM repository_files WHERE repository_id = :rid"),
        {"rid": repo["id"]}
    ).mappings().all()
    
    assert len(rows) == 3
    for r in rows:
        assert r["status"] == "SKIPPED"
        assert r["skip_reason"] == "SECRET_FILE"

@pytest.mark.asyncio
async def test_empty_file_heuristics(db_session, test_user, tmp_path):
    repo_id = "test-repo-empty"
    repo = add_repository_for_user(
        db_session,
        owner_user_id=test_user["id"],
        repo_id=repo_id,
        remote_url=None,
        local_path=str(tmp_path),
        default_branch="main"
    )
    
    f_empty = tmp_path / "empty.py"
    f_empty.write_text("")  # empty file
    
    await upsert_file_records(
        db_session,
        repository_id=repo["id"],
        repo_root=tmp_path,
        commit_sha="commit-sha-1",
        file_list=[f_empty]
    )
    
    rows = db_session.execute(
        text("SELECT path, skip_reason, status FROM repository_files WHERE repository_id = :rid"),
        {"rid": repo["id"]}
    ).mappings().all()
    
    assert len(rows) == 1
    assert rows[0]["status"] == "SKIPPED"
    assert rows[0]["skip_reason"] == "EMPTY_FILE"

@pytest.mark.asyncio
async def test_insights_aggregation(db_session, test_user, tmp_path):
    repo_id = "test-repo-insights-v2"
    repo = add_repository_for_user(
        db_session,
        owner_user_id=test_user["id"],
        repo_id=repo_id,
        remote_url=None,
        local_path=str(tmp_path),
        default_branch="main"
    )
    
    f1 = tmp_path / "main.py"
    f1.write_text("print('hello')\nprint('world')")
    
    f2 = tmp_path / "empty.py"
    f2.write_text("")
    
    f3 = tmp_path / ".env"
    f3.write_text("KEY=val")
    
    f4 = tmp_path / "unsupported.abc"
    f4.write_text("hello")
    
    # 1 indexed, 3 skipped
    await upsert_file_records(
        db_session,
        repository_id=repo["id"],
        repo_root=tmp_path,
        commit_sha="sha123",
        file_list=[f1, f2, f3, f4]
    )
    
    insights = get_repository_insights(db_session, repo["id"])
    
    assert insights["files_total"] == 4
    assert insights["files_indexed"] == 1
    assert insights["files_skipped"] == 3
    assert insights["skip_reason_breakdown"]["EMPTY_FILE"] == 1
    assert insights["skip_reason_breakdown"]["SECRET_FILE"] == 1
    assert insights["skip_reason_breakdown"]["UNSUPPORTED_EXTENSION"] == 1
    assert "python" in insights["language_breakdown"]
    assert len(insights["largest_files"]) >= 1
    assert "indexing_health" in insights
