"""Unit tests for plan JSON parsing and plan file generation."""

from pathlib import Path

from app.services.plan_parser import (
    _default_plan,
    collect_act_target_files,
    enrich_plan_json,
    parse_plan_from_text,
    plan_to_act_prompt,
    render_plan_file_markdown,
    render_plan_task_file_markdown,
    strip_machine_readable_sections,
    write_all_plan_artifacts,
    write_plan_file,
    write_plan_task_files,
    plan_task_file_rel_path,
)


def test_parse_plan_from_json_fence() -> None:
    text = """## Summary
Refactor auth.

```json
{
  "summary": "Refactor auth module",
  "steps": [
    {"id": "1", "title": "Update login", "files": ["src/auth.ts"], "description": "Fix token refresh"}
  ],
  "risks": ["Breaking change"],
  "testing_strategy": ["Run unit tests"]
}
```
"""
    plan, md = parse_plan_from_text(text)
    assert plan["summary"] == "Refactor auth module"
    assert len(plan["steps"]) == 1
    assert plan["steps"][0]["files"] == ["src/auth.ts"]
    assert "Refactor auth module" in md


def test_parse_plan_skips_css_fence_before_json() -> None:
    text = """**Summary**

### Improve Responsiveness
```css
@media (max-width: 768px) { .font-size-large { font-size: 1rem; } }
```

### Machine-Readable Plan
```json
{
  "summary": "Enhance CSS",
  "architecture": ["Use media queries", "Minify files"],
  "steps": [
    {"id": "1", "title": "Improve responsiveness", "files": ["layout.css"], "description": "Add queries"}
  ],
  "risks": ["Regression"],
  "testing_strategy": ["Manual QA"]
}
```
"""
    plan, _ = parse_plan_from_text(text)
    assert plan["summary"] == "Enhance CSS"
    assert len(plan["steps"]) == 1
    assert "media queries" in plan["architecture"]
    assert plan["risks"] == ["Regression"]


def test_plan_to_act_prompt_includes_steps() -> None:
    prompt = plan_to_act_prompt(
        {
            "summary": "Add feature",
            "steps": [{"id": "1", "title": "Edit file", "files": ["a.py"], "description": "Do thing"}],
        }
    )
    assert "APPROVED" in prompt
    assert "a.py" in prompt
    assert "unified diff" in prompt.lower()


def test_parse_plan_from_markdown_sections() -> None:
    text = """# 1. Summary
Do the thing.

# 4. Implementation Steps
- First step
- Second step

# 5. Risks
- Might break tests
"""
    plan, _ = parse_plan_from_text(text)
    assert plan["summary"]
    assert len(plan["steps"]) == 2
    assert plan["risks"]


def test_infer_steps_from_prose_headings() -> None:
    text = """# Enhance CSS

## Summary
To enhance the CSS of the project, consider the following suggestions:

### Improve Responsiveness
Use media queries for font sizes.

### Optimize Performance
Use CSS sprites for icons.
"""
    plan = enrich_plan_json(_default_plan(), text)
    assert len(plan["steps"]) == 2
    assert plan["steps"][0]["title"] == "Improve Responsiveness"
    assert plan["steps"][1]["title"] == "Optimize Performance"


def test_collect_act_target_files_from_markdown() -> None:
    md = """## Affected Files
- `frontend/src/styles/main.css`
- frontend/src/components/Button.tsx
- Use Node.js for the build
"""
    plan = enrich_plan_json(_default_plan(), md)
    files = collect_act_target_files(plan, md)
    assert "frontend/src/styles/main.css" in files
    assert "frontend/src/components/Button.tsx" in files
    assert "Node.js" not in files
    assert all("node.js" not in f.lower() or "/" in f for f in files)


def test_strip_machine_readable_sections() -> None:
    text = """## Summary
Hello

### Machine-Readable Plan
```json
{"summary": "x"}
```

## Architecture
More text
"""
    cleaned = strip_machine_readable_sections(text)
    assert "json" not in cleaned.lower()
    assert "Hello" in cleaned
    assert "Architecture" in cleaned


def test_render_plan_file_markdown_includes_steps(tmp_path: Path, monkeypatch) -> None:
    from app.services import plan_parser

    repo_dir = tmp_path / "owner_repo"
    repo_dir.mkdir(parents=True)
    monkeypatch.setattr(plan_parser, "repository_cache_dir", lambda slug: repo_dir)

    plan = {
        "summary": "Optimize CSS",
        "architecture": "- Use variables",
        "steps": [{"id": "1", "title": "Refactor", "files": ["a.css"], "description": "Clean up", "done": False}],
        "risks": ["Scope creep"],
        "testing_strategy": ["Visual diff"],
    }
    rel = write_plan_file(
        repo_slug="owner/repo",
        change_set_id="abcd1234-5678-90ab-cdef-1234567890ab",
        plan_version=1,
        plan_json=plan,
        query="optimize css",
    )
    assert rel == ".aicc/plans/plan-abcd1234-v1.md"
    content = (repo_dir / rel).read_text(encoding="utf-8")
    assert "Optimize CSS" in content
    assert "Refactor" in content
    assert "a.css" in content
    assert "```json" not in content

    rendered = render_plan_file_markdown(plan, change_set_id="abcd1234", plan_version=1)
    assert "Optimize CSS" in rendered
    assert "- [ ] Complete this step" in rendered


def test_write_plan_task_files_one_per_step(tmp_path: Path, monkeypatch) -> None:
    from app.services import plan_parser

    repo_dir = tmp_path / "owner_repo"
    repo_dir.mkdir(parents=True)
    monkeypatch.setattr(plan_parser, "repository_cache_dir", lambda slug: repo_dir)

    cs_id = "abcd1234-5678-90ab-cdef-1234567890ab"
    plan = {
        "summary": "Three-step plan",
        "steps": [
            {"id": "1", "title": "First", "files": ["a.ts"], "description": "Do first", "done": False},
            {"id": "2", "title": "Second", "files": ["b.ts"], "description": "Do second", "done": False},
            {"id": "3", "title": "Third", "files": [], "description": "Do third", "done": False},
        ],
    }
    updated, tasks = write_plan_task_files(
        repo_slug="owner/repo",
        change_set_id=cs_id,
        plan_version=1,
        plan_json=plan,
    )
    assert len(tasks) == 3
    assert len(updated["steps"]) == 3
    for step in updated["steps"]:
        assert step["task_file_path"]
        assert (repo_dir / step["task_file_path"]).is_file()
    assert tasks[0]["id"] == "1"
    assert tasks[0]["path"] == plan_task_file_rel_path(cs_id, 1, "1")

    content = (repo_dir / tasks[1]["path"]).read_text(encoding="utf-8")
    assert "Task 2: Second" in content
    assert "b.ts" in content


def test_write_all_plan_artifacts(tmp_path: Path, monkeypatch) -> None:
    from app.services import plan_parser

    repo_dir = tmp_path / "owner_repo"
    repo_dir.mkdir(parents=True)
    monkeypatch.setattr(plan_parser, "repository_cache_dir", lambda slug: repo_dir)

    cs_id = "abcd1234-5678-90ab-cdef-1234567890ab"
    plan = {
        "summary": "Full plan",
        "steps": [{"id": "1", "title": "Only step", "files": [], "description": "x", "done": False}],
    }
    main_path, updated, tasks = write_all_plan_artifacts(
        repo_slug="owner/repo",
        change_set_id=cs_id,
        plan_version=1,
        plan_json=plan,
    )
    assert main_path == ".aicc/plans/plan-abcd1234-v1.md"
    assert len(tasks) == 1
    assert updated["steps"][0]["task_file_path"]
