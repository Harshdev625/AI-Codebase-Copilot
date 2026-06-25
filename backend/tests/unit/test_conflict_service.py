"""Unit tests for ConflictService drift detection."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.conflict_service import ConflictService


def _patch_draft(*, base_commit: str = "abc123", files=None):
    draft = MagicMock()
    draft.base_commit_sha = base_commit
    draft.patch_files = files or []
    draft.status = "DRAFT"
    return draft


def test_detect_drift_repo_not_found():
    session = MagicMock()
    session.execute.return_value.mappings.return_value.first.return_value = None
    draft = _patch_draft()
    service = ConflictService(session)

    assert service.detect_drift("repo-missing", draft) is True
    assert draft.status == "CONFLICTED"
    session.commit.assert_called()


def test_detect_drift_no_local_path_mismatched_commit():
    session = MagicMock()
    session.execute.return_value.mappings.return_value.first.return_value = {
        "local_path": None,
        "latest_indexed_commit": "other-sha",
    }
    draft = _patch_draft(base_commit="abc123")
    service = ConflictService(session)

    assert service.detect_drift("repo-1", draft) is True
    assert draft.status == "CONFLICTED"


def test_detect_drift_matching_commit_no_files():
    session = MagicMock()
    session.execute.return_value.mappings.return_value.first.return_value = {
        "local_path": None,
        "latest_indexed_commit": "abc123",
    }
    draft = _patch_draft(base_commit="abc123")
    service = ConflictService(session)

    assert service.detect_drift("repo-1", draft) is False
    assert draft.status == "DRAFT"


def test_detect_drift_modified_file_hash_mismatch(tmp_path):
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    (repo_path / "main.py").write_text("current content", encoding="utf-8")

    pf = MagicMock()
    pf.file_path = "main.py"
    pf.action = "MODIFIED"
    pf.content_hash_before = "expected-not-matching"

    session = MagicMock()

    def execute_side_effect(*_args, **_kwargs):
        result = MagicMock()
        mapping = MagicMock()
        stmt = str(_args[0]) if _args else ""
        if "repositories" in stmt:
            mapping.first.return_value = {
                "local_path": str(repo_path),
                "latest_indexed_commit": "abc123",
            }
        else:
            mapping.first.return_value = None
        result.mappings.return_value = mapping
        return result

    session.execute.side_effect = execute_side_effect

    with patch("subprocess.run") as mock_git:
        mock_git.return_value = MagicMock(returncode=0, stdout="abc123\n")
        draft = _patch_draft(base_commit="abc123", files=[pf])
        service = ConflictService(session)
        assert service.detect_drift("repo-1", draft) is True
        assert draft.status == "CONFLICTED"


def test_detect_drift_added_file_already_exists(tmp_path):
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    (repo_path / "new.py").write_text("exists", encoding="utf-8")

    pf = MagicMock()
    pf.file_path = "new.py"
    pf.action = "ADDED"
    pf.content_hash_before = None

    session = MagicMock()

    def execute_side_effect(*_args, **_kwargs):
        result = MagicMock()
        mapping = MagicMock()
        stmt = str(_args[0]) if _args else ""
        if "repositories" in stmt:
            mapping.first.return_value = {
                "local_path": str(repo_path),
                "latest_indexed_commit": "abc123",
            }
        else:
            mapping.first.return_value = None
        result.mappings.return_value = mapping
        return result

    session.execute.side_effect = execute_side_effect

    with patch("subprocess.run") as mock_git:
        mock_git.return_value = MagicMock(returncode=0, stdout="abc123\n")
        draft = _patch_draft(base_commit="abc123", files=[pf])
        service = ConflictService(session)
        assert service.detect_drift("repo-1", draft) is True
