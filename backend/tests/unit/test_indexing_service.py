"""Unit tests for IndexingService internal helpers."""
import pytest
from pathspec import PathSpec
from pathspec.patterns import GitWildMatchPattern

from app.services.indexing_service import IndexingService


@pytest.fixture
def svc():
    # IndexingService requires a Session, but these tests only exercise
    # pure helper methods that do not touch the DB.
    return IndexingService.__new__(IndexingService)


class TestSlugifyRepoId:
    def test_plain_name_is_unchanged(self, svc):
        assert svc._slugify_repo_id("myrepo") == "myrepo"

    def test_spaces_become_dashes(self, svc):
        assert svc._slugify_repo_id("my repo") == "my-repo"

    def test_special_chars_become_dashes(self, svc):
        slug = svc._slugify_repo_id("owner/repo-name")
        assert "/" not in slug
        assert slug == "owner-repo-name"

    def test_consecutive_non_safe_chars_become_single_dash(self, svc):
        # "!!" → "-" (one dash), so "my--repo!!name" → "my--repo-name"
        # Existing dashes are preserved; only non-safe runs are replaced.
        slug = svc._slugify_repo_id("my--repo!!name")
        assert "!!" not in slug
        assert slug == "my--repo-name"

    def test_leading_trailing_dots_stripped(self, svc):
        slug = svc._slugify_repo_id("...repo...")
        assert not slug.startswith(".")
        assert not slug.endswith(".")

    def test_empty_string_returns_fallback(self, svc):
        assert svc._slugify_repo_id("") == "repo"

    def test_only_special_chars_returns_fallback(self, svc):
        assert svc._slugify_repo_id("!!!") == "repo"

    def test_github_url_style(self, svc):
        slug = svc._slugify_repo_id("github.com/user/project")
        assert "github.com" not in slug or "-" in slug  # transformed

    def test_alphanumeric_dots_dashes_preserved(self, svc):
        slug = svc._slugify_repo_id("my-project.v2")
        assert slug == "my-project.v2"


class _NoopSession:
    def execute(self, *args, **kwargs):
        _ = (args, kwargs)
        return None

    def commit(self):
        return None

    def rollback(self):
        return None


def _new_indexing_service() -> IndexingService:
    service = IndexingService.__new__(IndexingService)
    service.session = _NoopSession()
    return service


def test_index_repository_falls_back_to_generic_for_python_without_ast_chunks(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
):
    python_file = tmp_path / "sample.py"
    python_file.write_text("print('hello')\nprint('world')\n", encoding="utf-8")

    captured_chunks = []
    service = _new_indexing_service()

    monkeypatch.setattr(IndexingService, "_resolve_repo_root", lambda self, *args, **kwargs: tmp_path)
    monkeypatch.setattr(IndexingService, "_should_cleanup_cached_repo", lambda self, root, repo_url, repo_path: False)
    monkeypatch.setattr(
        IndexingService,
        "_load_gitignore_spec",
        lambda self, repo_root: PathSpec.from_lines(GitWildMatchPattern, []),
    )
    monkeypatch.setattr(
        IndexingService,
        "_iter_indexable_files",
        lambda self, repo_root, spec: [python_file],
    )
    monkeypatch.setattr(IndexingService, "_update_progress", lambda self, *args, **kwargs: None)
    monkeypatch.setattr(IndexingService, "_upsert_chunks", lambda self, chunks: captured_chunks.extend(chunks))
    monkeypatch.setattr(IndexingService, "_rebuild_repo_graph", lambda self, repo_id: None)

    import app.services.indexing_service as indexing_module

    monkeypatch.setattr(indexing_module, "chunk_python_file", lambda *args, **kwargs: [])

    total = service.index_repository(repo_id="repo", commit_sha="commit", repo_path=str(tmp_path))

    assert total == 1
    assert len(captured_chunks) == 1
    assert captured_chunks[0].chunk_type == "generic"
    assert captured_chunks[0].language == "py"


def test_index_repository_falls_back_to_generic_for_python_ast_errors(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
):
    python_file = tmp_path / "broken.py"
    python_file.write_text("def bad(:\n    pass\n", encoding="utf-8")

    captured_chunks = []
    service = _new_indexing_service()

    monkeypatch.setattr(IndexingService, "_resolve_repo_root", lambda self, *args, **kwargs: tmp_path)
    monkeypatch.setattr(IndexingService, "_should_cleanup_cached_repo", lambda self, root, repo_url, repo_path: False)
    monkeypatch.setattr(
        IndexingService,
        "_load_gitignore_spec",
        lambda self, repo_root: PathSpec.from_lines(GitWildMatchPattern, []),
    )
    monkeypatch.setattr(
        IndexingService,
        "_iter_indexable_files",
        lambda self, repo_root, spec: [python_file],
    )
    monkeypatch.setattr(IndexingService, "_update_progress", lambda self, *args, **kwargs: None)
    monkeypatch.setattr(IndexingService, "_upsert_chunks", lambda self, chunks: captured_chunks.extend(chunks))
    monkeypatch.setattr(IndexingService, "_rebuild_repo_graph", lambda self, repo_id: None)

    import app.services.indexing_service as indexing_module

    def _raise_parse_error(*args, **kwargs):
        _ = (args, kwargs)
        raise SyntaxError("invalid syntax")

    monkeypatch.setattr(indexing_module, "chunk_python_file", _raise_parse_error)

    total = service.index_repository(repo_id="repo", commit_sha="commit", repo_path=str(tmp_path))

    assert total == 1
    assert len(captured_chunks) == 1
    assert captured_chunks[0].chunk_type == "generic"
    assert captured_chunks[0].language == "py"
