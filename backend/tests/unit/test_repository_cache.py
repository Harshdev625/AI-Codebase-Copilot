import subprocess
from pathlib import Path

from app.core.config import settings
from app.services.repository_cache import (
    WORKING_COPY_COMMIT,
    normalize_repository_file_path,
    read_repository_file,
    read_workspace_file_bytes,
    repo_cache_root,
    repository_cache_dir,
    resolve_git_commit,
    slugify_repo_id,
)


def test_repo_cache_path_is_absolute_under_backend():
    cache = Path(settings.repo_cache_path)
    assert cache.is_absolute()
    assert cache.name == ".repo_cache"


def test_repository_cache_dir_slug():
    path = repository_cache_dir("harshdev625/timemachine")
    assert path.parent == repo_cache_root()
    assert path.name == slugify_repo_id("harshdev625/timemachine")


def _init_git_repo(path: Path, filename: str, content: str) -> None:
    path.mkdir(parents=True)
    (path / filename).write_text(content, encoding="utf-8")
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)
    subprocess.run(["git", "add", filename], cwd=path, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "init"],
        cwd=path,
        check=True,
        capture_output=True,
        env={"GIT_AUTHOR_NAME": "test", "GIT_AUTHOR_EMAIL": "t@e.com", "GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "t@e.com", **dict(__import__("os").environ)},
    )


def test_resolve_git_commit_maps_working_copy_to_head(tmp_path: Path):
    repo = tmp_path / "repo"
    _init_git_repo(repo, "README.md", "hello")

    resolved = resolve_git_commit(repo, WORKING_COPY_COMMIT)
    head = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    assert resolved == head


def test_read_repository_file_uses_working_tree_for_working_copy(tmp_path: Path):
    repo = tmp_path / "repo"
    _init_git_repo(repo, "CHANGELOG.md", "# Changes\n")

    raw = read_repository_file(repo, "CHANGELOG.md", WORKING_COPY_COMMIT)
    assert raw is not None
    assert b"Changes" in raw


def test_read_workspace_file_bytes_rejects_traversal(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "safe.txt").write_text("ok", encoding="utf-8")

    assert read_workspace_file_bytes(repo, "../outside.txt") is None


def test_normalize_repository_file_path_relative_to_workspace(tmp_path: Path):
    repo = tmp_path / "timemachine"
    assets = repo / "assets"
    assets.mkdir(parents=True)
    script = assets / "script.js"
    script.write_text("console.log(1)", encoding="utf-8")

    abs_path = str(script.resolve())
    assert normalize_repository_file_path(abs_path, workspace=repo) == "assets/script.js"
    assert normalize_repository_file_path("assets/script.js", workspace=repo) == "assets/script.js"


def test_normalize_repository_file_path_strips_after_workspace_name(tmp_path: Path):
    repo = tmp_path / "timemachine"
    docs = repo / "docs"
    docs.mkdir(parents=True)
    changelog = docs / "CHANGELOG.md"
    changelog.write_text("# Log", encoding="utf-8")

    long_path = f"Projects/AI Codebase Copilot/timemachine/docs/CHANGELOG.md"
    assert normalize_repository_file_path(long_path, workspace=repo) == "docs/CHANGELOG.md"
