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


def test_search_whole_word(sample_repo: Path):
    (sample_repo / "partial.txt").write_text("prefixuseStudioStoresuffix\n", encoding="utf-8")
    loose = search_workspace_python(sample_repo, "useStudioStore", whole_word=False)
    strict = search_workspace_python(sample_repo, "useStudioStore", whole_word=True)
    assert any(f.path == "partial.txt" for f in loose.files)
    assert not any(f.path == "partial.txt" for f in strict.files)


def test_search_regex(sample_repo: Path):
    result = search_workspace_python(sample_repo, r"use\w+Store", use_regex=True)
    assert result.total_matches >= 1


def test_search_exclude_glob(sample_repo: Path):
    result = search_workspace_python(
        sample_repo,
        "useStudioStore",
        exclude_globs=["**/src/**"],
    )
    paths = {f.path for f in result.files}
    assert "README.md" in paths
    assert "src/app.ts" not in paths


def test_search_truncates_at_max_results(sample_repo: Path):
    for i in range(5):
        (sample_repo / f"file{i}.txt").write_text("needle\n", encoding="utf-8")
    result = search_workspace_python(sample_repo, "needle", max_results=2)
    assert result.truncated is True
    assert result.total_matches == 2
    assert result.total_files == 2


def test_search_skips_large_files(sample_repo: Path):
    huge = sample_repo / "huge.txt"
    huge.write_text("x" * (2_000_001), encoding="utf-8")
    result = search_workspace_python(sample_repo, "x")
    assert not any(f.path == "huge.txt" for f in result.files)


def test_search_result_to_dict(sample_repo: Path):
    result = search_workspace_python(sample_repo, "useStudioStore", max_results=5)
    payload = result.to_dict()
    assert payload["engine"] == "python"
    assert payload["total_matches"] == result.total_matches
    assert isinstance(payload["files"], list)
    if payload["files"]:
        assert "matches" in payload["files"][0]


def test_search_workspace_prefers_ripgrep(sample_repo: Path):
    from unittest.mock import patch

    from app.services.workspace_search import (
        SearchFileResult,
        SearchMatch,
        WorkspaceSearchResult,
        search_workspace,
    )

    rg_result = WorkspaceSearchResult(
        files=[SearchFileResult(path="README.md", matches=[SearchMatch(1, 1, "preview")])],
        total_matches=1,
        total_files=1,
        truncated=False,
        engine="ripgrep",
    )
    with patch("app.services.workspace_search.search_workspace_ripgrep", return_value=rg_result):
        result = search_workspace(sample_repo, "useStudioStore")
    assert result.engine == "ripgrep"


def test_search_workspace_falls_back_to_python(sample_repo: Path):
    from unittest.mock import patch

    from app.services.workspace_search import search_workspace

    with patch("app.services.workspace_search.search_workspace_ripgrep", return_value=None):
        result = search_workspace(sample_repo, "useStudioStore")
    assert result.engine == "python"
    assert result.total_matches >= 1


def test_search_workspace_ripgrep_no_rg_binary():
    from unittest.mock import patch

    from app.services.workspace_search import search_workspace_ripgrep

    with patch("app.services.workspace_search.shutil.which", return_value=None):
        assert search_workspace_ripgrep(Path("."), "query") is None


def test_search_workspace_ripgrep_parses_json(tmp_path: Path):
    from unittest.mock import MagicMock, patch

    from app.services.workspace_search import search_workspace_ripgrep

    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.ts").write_text("const value = 1;\n", encoding="utf-8")

    rg_line = (
        '{"type":"match","data":{"path":{"text":"src/app.ts"},'
        '"line_number":1,"lines":{"text":"const value = 1;"},'
        '"submatches":[{"start":6,"end":11}]}}'
    )
    with patch("app.services.workspace_search.shutil.which", return_value="/usr/bin/rg"):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout=rg_line + "\n", stderr="")
            result = search_workspace_ripgrep(tmp_path, "value")
    assert result is not None
    assert result.engine == "ripgrep"
    assert result.total_matches == 1
    assert result.files[0].path == "src/app.ts"


def test_search_workspace_ripgrep_handles_failure(tmp_path: Path):
    from unittest.mock import MagicMock, patch

    from app.services.workspace_search import search_workspace_ripgrep

    with patch("app.services.workspace_search.shutil.which", return_value="/usr/bin/rg"):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=2, stdout="", stderr="error")
            assert search_workspace_ripgrep(tmp_path, "value") is None


def test_search_workspace_ripgrep_empty_query(tmp_path: Path):
    from unittest.mock import patch

    from app.services.workspace_search import search_workspace_ripgrep

    with patch("app.services.workspace_search.shutil.which", return_value="/usr/bin/rg"):
        result = search_workspace_ripgrep(tmp_path, "  ")
    assert result is not None
    assert result.total_matches == 0
    assert result.engine == "ripgrep"

