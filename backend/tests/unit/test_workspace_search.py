import pytest
from pathlib import Path

from app.services.workspace_search import search_workspace_python


@pytest.fixture
def sample_repo(tmp_path: Path) -> Path:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.ts").write_text(
        "export const useStudioStore = () => null;\nconst x = useStudioStore();\n",
        encoding="utf-8",
    )
    (tmp_path / "README.md").write_text("# useStudioStore demo\n", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("useStudioStore", encoding="utf-8")
    return tmp_path


def test_search_finds_matches(sample_repo: Path):
    result = search_workspace_python(sample_repo, "useStudioStore")
    assert result.total_matches >= 2
    paths = {f.path for f in result.files}
    assert "src/app.ts" in paths
    assert not any("node_modules" in p for p in paths)


def test_search_case_sensitive(sample_repo: Path):
    result = search_workspace_python(sample_repo, "usestudiostore", case_sensitive=True)
    assert result.total_matches == 0


def test_search_include_glob(sample_repo: Path):
    result = search_workspace_python(
        sample_repo,
        "useStudioStore",
        include_globs=["**/*.md"],
    )
    assert result.total_files == 1
    assert result.files[0].path == "README.md"


def test_search_empty_query(sample_repo: Path):
    result = search_workspace_python(sample_repo, "   ")
    assert result.total_matches == 0
