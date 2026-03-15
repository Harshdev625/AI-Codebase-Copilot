"""Unit tests for IndexingService internal helpers."""
import pytest

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
