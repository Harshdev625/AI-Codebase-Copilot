from __future__ import annotations

import json
import re
from typing import Any

from app.services.repository_cache import repository_cache_dir

PLAN_FILE_DIR = ".aicc/plans"
PLAN_TASK_SUBDIR = "tasks"


def _safe_step_id(step_id: str) -> str:
    cleaned = re.sub(r"[^\w\-]", "-", str(step_id or "step").strip())
    return cleaned[:64] or "step"


def plan_task_file_rel_path(change_set_id: str, plan_version: int, step_id: str) -> str:
    sid = _safe_step_id(step_id)
    return f"{PLAN_FILE_DIR}/{PLAN_TASK_SUBDIR}/{change_set_id[:8]}-v{plan_version}/task-{sid}.md"


def _default_plan() -> dict[str, Any]:
    return {
        "summary": "",
        "steps": [],
        "risks": [],
        "testing_strategy": [],
    }


def _normalize_architecture(value: Any) -> str:
    if isinstance(value, list):
        lines = [str(item).strip() for item in value if str(item).strip()]
        return "\n".join(f"- {line.lstrip('- ').strip()}" for line in lines)
    return str(value or "").strip()


def parse_plan_from_text(text: str) -> tuple[dict[str, Any], str]:
    """Extract structured plan JSON from LLM output; return (plan_json, plan_markdown)."""
    raw = str(text or "").strip()
    if not raw:
        return _default_plan(), ""

    parsed = _extract_plan_json(raw)
    if parsed is not None:
        return enrich_plan_json(parsed, raw), raw

    brace_match = re.search(r"\{[\s\S]*\"steps\"[\s\S]*\}", raw)
    if brace_match:
        try:
            candidate = json.loads(brace_match.group(0))
            if isinstance(candidate, dict):
                return enrich_plan_json(_normalize_plan(candidate), raw), raw
        except json.JSONDecodeError:
            pass

    return enrich_plan_json(_plan_from_markdown_sections(raw), raw), raw


_FILE_PATH_RE = re.compile(
    r"[`\"']?"
    r"([A-Za-z0-9_][A-Za-z0-9_./\-]*"
    r"\.(?:css|scss|less|tsx?|jsx?|py|md|json|html|vue|svelte|yaml|yml|toml|rs|go|java|kt|rb|php|sql|xml|svg))"
    r"[`\"']?",
    re.IGNORECASE,
)


def _normalize_repo_path(path: str) -> str:
    cleaned = str(path or "").strip().replace("\\", "/")
    cleaned = cleaned.lstrip("./")
    if cleaned.startswith("a/") or cleaned.startswith("b/"):
        cleaned = cleaned[2:]
    return cleaned


_KNOWN_FALSE_FILE_BASENAMES = frozenset({
    "node.js",
    "react.js",
    "vue.js",
    "next.js",
    "express.js",
    "npm.js",
    "yarn.js",
    "pnpm.js",
})


def is_plausible_repo_file_path(path: str) -> bool:
    """Reject technology names and other false positives from plan prose."""
    norm = _normalize_repo_path(path)
    if not norm or ".." in norm.split("/"):
        return False
    basename = norm.split("/")[-1]
    lower = basename.lower()
    if lower in _KNOWN_FALSE_FILE_BASENAMES:
        return False
    # e.g. Node.js mentioned in prose — real files are usually lowercase (main.py, style.css)
    if "/" not in norm and re.match(r"^[A-Z][A-Za-z0-9]*\.[a-z]{2,4}$", basename):
        return False
    return True


def extract_file_paths_from_text(text: str) -> list[str]:
    """Collect plausible repository-relative file paths from plan prose."""
    if not text.strip():
        return []
    found: list[str] = []
    for match in _FILE_PATH_RE.finditer(text):
        candidate = _normalize_repo_path(match.group(1))
        if candidate and is_plausible_repo_file_path(candidate):
            found.append(candidate)
    return list(dict.fromkeys(found))


def collect_act_target_files(plan_json: dict[str, Any], markdown: str = "") -> list[str]:
    """Merge file targets from plan steps, JSON fields, and markdown prose."""
    paths: list[str] = []
    for step in (plan_json or {}).get("steps") or []:
        if isinstance(step, dict):
            for f in step.get("files") or []:
                if f and is_plausible_repo_file_path(str(f)):
                    paths.append(_normalize_repo_path(str(f)))
    for key in ("affected_files", "files"):
        raw = (plan_json or {}).get(key)
        if isinstance(raw, list):
            for f in raw:
                if f and is_plausible_repo_file_path(str(f)):
                    paths.append(_normalize_repo_path(str(f)))
    paths.extend(extract_file_paths_from_text(str(markdown or "")))
    return list(dict.fromkeys(p for p in paths if p))


_SKIP_STEP_HEADINGS = {
    "summary",
    "architecture",
    "affected files",
    "implementation steps",
    "risks",
    "testing strategy",
    "details",
    "machine-readable plan",
    "description",
    "checklist",
    "files to modify",
    "plan",
}


def enrich_plan_json(plan_json: dict[str, Any], markdown: str = "") -> dict[str, Any]:
    """Fill missing summary/steps from prose markdown when JSON or sections are incomplete."""
    plan = _normalize_plan(plan_json if isinstance(plan_json, dict) else {})
    md = strip_machine_readable_sections(str(markdown or ""))

    if not plan.get("summary") and md:
        for line in md.splitlines():
            stripped = line.strip()
            if re.match(r"^#+\s*summary\s*$", stripped, re.IGNORECASE):
                continue
            if stripped and not stripped.startswith("#") and not stripped.startswith("```"):
                plan["summary"] = stripped[:400]
                break

    if not plan.get("steps"):
        inferred = _infer_steps_from_markdown(md)
        if inferred:
            plan["steps"] = inferred

    affected = collect_act_target_files(plan, md)
    if affected:
        plan["affected_files"] = affected
        for step in plan.get("steps") or []:
            if isinstance(step, dict) and not step.get("files"):
                step["files"] = list(affected)

    return plan


def _infer_steps_from_markdown(text: str) -> list[dict[str, Any]]:
    """Derive implementation steps from prose headings (e.g. ### Improve Responsiveness)."""
    if not text.strip():
        return []

    steps: list[dict[str, Any]] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        match = re.match(r"^(#{2,3})\s+(.+)$", line.strip())
        if not match:
            i += 1
            continue

        level = len(match.group(1))
        title = re.sub(r"^\d+\.\s*", "", match.group(2).strip()).strip("*_ ")
        key = title.lower()
        if key in _SKIP_STEP_HEADINGS or key.startswith("task "):
            i += 1
            continue

        body_lines: list[str] = []
        i += 1
        while i < len(lines):
            nxt = lines[i]
            heading = re.match(r"^(#+)\s+", nxt.strip())
            if heading and len(heading.group(1)) <= level:
                break
            body_lines.append(nxt)
            i += 1

        body = "\n".join(body_lines).strip()
        if len(title) > 2:
            steps.append(
                {
                    "id": str(len(steps) + 1),
                    "title": title,
                    "files": [],
                    "description": body[:800] if body else title,
                    "done": False,
                }
            )

    return steps[:25]


def _extract_plan_json(raw: str) -> dict[str, Any] | None:
    """Find the machine-readable plan JSON, skipping css/html/etc. fenced blocks."""
    json_blocks = re.findall(r"```json\s*\n([\s\S]*?)```", raw, re.IGNORECASE)
    candidates = [c.strip() for c in json_blocks]
    if not candidates:
        for match in re.finditer(r"```\w*\s*\n([\s\S]*?)```", raw):
            body = match.group(1).strip()
            if body.startswith("{"):
                candidates.append(body)

    for candidate in reversed(candidates):
        if not candidate.startswith("{"):
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and ("steps" in parsed or "summary" in parsed):
            return _normalize_plan(parsed)
    return None


def _normalize_plan(data: dict[str, Any]) -> dict[str, Any]:
    steps_raw = data.get("steps") or []
    steps: list[dict[str, Any]] = []
    if isinstance(steps_raw, list):
        for idx, item in enumerate(steps_raw, start=1):
            if isinstance(item, str):
                steps.append({"id": str(idx), "title": item, "files": [], "description": item, "done": False})
            elif isinstance(item, dict):
                steps.append(
                    {
                        "id": str(item.get("id") or idx),
                        "title": str(item.get("title") or f"Step {idx}"),
                        "files": [str(f) for f in (item.get("files") or []) if f],
                        "description": str(item.get("description") or item.get("title") or ""),
                        "done": bool(item.get("done", False)),
                    }
                )
    return {
        "summary": str(data.get("summary") or ""),
        "architecture": _normalize_architecture(data.get("architecture")),
        "steps": steps,
        "risks": [str(r) for r in (data.get("risks") or []) if r],
        "testing_strategy": [str(t) for t in (data.get("testing_strategy") or []) if t],
    }


def _plan_from_markdown_sections(text: str) -> dict[str, Any]:
    """Best-effort parse from PLAN mode markdown sections."""
    plan = _default_plan()
    sections = {
        "summary": r"^#+\s*1\.?\s*summary\s*$|^\*\*summary\*\*\s*$",
        "architecture": r"^#+\s*2\.?\s*architecture\s*$|^\*\*architecture\*\*\s*$",
        "affected": r"^#+\s*3\.?\s*affected files\s*$|^\*\*affected files\*\*\s*$",
        "steps": r"^#+\s*4\.?\s*implementation steps\s*$|^\*\*implementation steps\*\*\s*$|^#+\s*implementation steps\s*$",
        "risks": r"^#+\s*5\.?\s*risks\s*$|^\*\*risks\*\*\s*$",
        "testing": r"^#+\s*6\.?\s*testing strategy\s*$|^\*\*testing strategy\*\*\s*$",
    }
    lines = text.splitlines()
    current = None
    buckets: dict[str, list[str]] = {k: [] for k in sections}

    for line in lines:
        matched = False
        stripped = line.strip()
        for key, pattern in sections.items():
            if re.match(pattern, stripped, re.IGNORECASE):
                current = key
                matched = True
                break
        if not matched and current:
            buckets[current].append(line)

    plan["summary"] = "\n".join(buckets["summary"]).strip()
    plan["architecture"] = "\n".join(buckets["architecture"]).strip()

    step_lines = [ln.strip("- ").strip() for ln in buckets["steps"] if ln.strip()]
    plan["steps"] = [
        {"id": str(i + 1), "title": ln, "files": [], "description": ln, "done": False}
        for i, ln in enumerate(step_lines)
        if ln
    ]
    plan["risks"] = [ln.strip("- ").strip() for ln in buckets["risks"] if ln.strip()]
    plan["testing_strategy"] = [ln.strip("- ").strip() for ln in buckets["testing"] if ln.strip()]
    return plan


def strip_machine_readable_sections(text: str) -> str:
    """Remove JSON plan blocks from markdown shown to users."""
    cleaned = str(text or "")
    cleaned = re.sub(
        r"(?im)^#+\s*machine-readable plan\s*$[\s\S]*?(?=^#+\s|\Z)",
        "",
        cleaned,
        flags=re.MULTILINE,
    )
    cleaned = re.sub(r"```json\s*\n[\s\S]*?```", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def render_plan_file_markdown(
    plan_json: dict[str, Any],
    *,
    plan_markdown: str = "",
    change_set_id: str,
    plan_version: int,
    status: str = "PLAN_READY",
    query: str = "",
) -> str:
    """Build a Cursor-style plan document for the repo workspace."""
    summary = str(plan_json.get("summary") or "").strip()
    title = summary.split(".")[0][:80] if summary else "Implementation plan"
    if query and not summary:
        title = query.strip()[:80]

    parts: list[str] = [
        "---",
        f"title: {title}",
        f"status: {status}",
        f"version: {plan_version}",
        f"change_set_id: {change_set_id}",
        "---",
        "",
        f"# {title}",
        "",
    ]

    if summary:
        parts.extend(["## Summary", "", summary, ""])

    architecture = _normalize_architecture(plan_json.get("architecture"))
    if architecture:
        parts.extend(["## Architecture", "", architecture, ""])

    steps = plan_json.get("steps") or []
    if steps:
        parts.extend(["## Implementation Steps", ""])
        for step in steps:
            if not isinstance(step, dict):
                continue
            sid = step.get("id", "")
            stitle = step.get("title") or f"Step {sid}"
            checkbox = "x" if step.get("done") else " "
            parts.append(f"### {sid}. {stitle}")
            files = step.get("files") or []
            if files:
                parts.append(f"**Files:** {', '.join(f'`{f}`' for f in files)}")
            desc = str(step.get("description") or "").strip()
            if desc and desc != stitle:
                parts.extend(["", desc])
            parts.extend(["", f"- [{checkbox}] Complete this step", ""])

    risks = plan_json.get("risks") or []
    if risks:
        parts.extend(["## Risks", ""])
        parts.extend(f"- {r}" for r in risks)
        parts.append("")

    testing = plan_json.get("testing_strategy") or []
    if testing:
        parts.extend(["## Testing Strategy", ""])
        parts.extend(f"- {t}" for t in testing)
        parts.append("")

    prose = strip_machine_readable_sections(plan_markdown)
    if prose and not summary and not steps:
        parts.extend(["## Details", "", prose, ""])

    parts.extend(
        [
            "---",
            "_Generated by AI Copilot Plan mode. Approve in Studio to proceed to Act._",
            "",
        ]
    )
    return "\n".join(parts)


def render_plan_task_file_markdown(
    step: dict[str, Any],
    *,
    change_set_id: str,
    plan_version: int,
    plan_summary: str = "",
    status: str = "PLAN_READY",
) -> str:
    """Build a single plan-step task document."""
    sid = str(step.get("id") or "1")
    title = str(step.get("title") or f"Step {sid}")
    description = str(step.get("description") or title).strip()
    files = [str(f) for f in (step.get("files") or []) if f]
    done = bool(step.get("done", False))
    task_status = "done" if done else status.lower().replace("_", "-")

    parts: list[str] = [
        "---",
        f"id: {sid}",
        f"title: {title}",
        f"status: {task_status}",
        f"plan_version: {plan_version}",
        f"change_set_id: {change_set_id}",
        "---",
        "",
        f"# Task {sid}: {title}",
        "",
    ]

    if plan_summary:
        parts.extend(["> Part of plan:", f"> {plan_summary}", ""])

    if description and description != title:
        parts.extend(["## Description", "", description, ""])

    if files:
        parts.extend(["## Files to modify", ""])
        parts.extend(f"- `{path}`" for path in files)
        parts.append("")

    checkbox = "x" if done else " "
    parts.extend(
        [
            "## Checklist",
            "",
            f"- [{checkbox}] Complete this task",
            "",
            "---",
            "_Plan task generated by AI Copilot. Open in Studio Tasks panel or editor._",
            "",
        ]
    )
    return "\n".join(parts)


def write_plan_task_files(
    *,
    repo_slug: str,
    change_set_id: str,
    plan_version: int,
    plan_json: dict[str, Any],
    status: str = "PLAN_READY",
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Write one markdown file per plan step. Returns (updated plan_json, task file metadata)."""
    workspace = repository_cache_dir(repo_slug)
    if not workspace.exists():
        return plan_json, []

    summary = str(plan_json.get("summary") or "")
    steps_raw = plan_json.get("steps") or []
    updated_steps: list[dict[str, Any]] = []
    task_files: list[dict[str, Any]] = []

    for step in steps_raw:
        if not isinstance(step, dict):
            continue
        sid = str(step.get("id") or len(updated_steps) + 1)
        rel_path = plan_task_file_rel_path(change_set_id, plan_version, sid)
        dest = workspace / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        content = render_plan_task_file_markdown(
            step,
            change_set_id=change_set_id,
            plan_version=plan_version,
            plan_summary=summary,
            status=status,
        )
        dest.write_text(content, encoding="utf-8")
        normalized_path = rel_path.replace("\\", "/")
        step_copy = dict(step)
        step_copy["task_file_path"] = normalized_path
        updated_steps.append(step_copy)
        task_files.append(
            {
                "id": sid,
                "title": str(step.get("title") or f"Step {sid}"),
                "path": normalized_path,
                "done": bool(step.get("done", False)),
                "files": [str(f) for f in (step.get("files") or []) if f],
            }
        )

    updated = dict(plan_json)
    updated["steps"] = updated_steps
    return updated, task_files


def write_all_plan_artifacts(
    *,
    repo_slug: str,
    change_set_id: str,
    plan_version: int,
    plan_json: dict[str, Any],
    plan_markdown: str = "",
    status: str = "PLAN_READY",
    query: str = "",
) -> tuple[str | None, dict[str, Any], list[dict[str, Any]]]:
    """Write master plan file and per-step task files."""
    plan_file_path = write_plan_file(
        repo_slug=repo_slug,
        change_set_id=change_set_id,
        plan_version=plan_version,
        plan_json=plan_json,
        plan_markdown=plan_markdown,
        status=status,
        query=query,
    )
    updated_json, task_files = write_plan_task_files(
        repo_slug=repo_slug,
        change_set_id=change_set_id,
        plan_version=plan_version,
        plan_json=plan_json,
        status=status,
    )
    return plan_file_path, updated_json, task_files


def write_plan_file(
    *,
    repo_slug: str,
    change_set_id: str,
    plan_version: int,
    plan_json: dict[str, Any],
    plan_markdown: str = "",
    status: str = "PLAN_READY",
    query: str = "",
) -> str | None:
    """Write plan markdown into `.aicc/plans/` inside the repo cache. Returns relative path."""
    workspace = repository_cache_dir(repo_slug)
    if not workspace.exists():
        return None

    rel_path = f"{PLAN_FILE_DIR}/plan-{change_set_id[:8]}-v{plan_version}.md"
    dest = workspace / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    content = render_plan_file_markdown(
        plan_json,
        plan_markdown=plan_markdown,
        change_set_id=change_set_id,
        plan_version=plan_version,
        status=status,
        query=query,
    )
    dest.write_text(content, encoding="utf-8")
    return rel_path.replace("\\", "/")


def plan_to_act_prompt(plan_json: dict[str, Any]) -> str:
    """Build ACT-mode execution prompt from an approved plan."""
    steps = plan_json.get("steps") or []
    target_files = collect_act_target_files(plan_json)
    step_lines = []
    for step in steps:
        if not isinstance(step, dict):
            continue
        files = ", ".join(step.get("files") or [])
        suffix = f" (files: {files})" if files else ""
        step_lines.append(f"- [{step.get('id')}] {step.get('title')}: {step.get('description', '')}{suffix}")

    parts = [
        "Execute the following APPROVED implementation plan as a unified diff patch.",
        f"Summary: {plan_json.get('summary', '')}",
    ]
    if plan_json.get("architecture"):
        parts.append(f"Architecture: {plan_json['architecture']}")
    if target_files:
        parts.append("Target files (modify ONLY these paths):\n" + "\n".join(f"- {p}" for p in target_files))
    if step_lines:
        parts.append("Steps:\n" + "\n".join(step_lines))
    if plan_json.get("testing_strategy"):
        parts.append("Testing: " + "; ".join(plan_json["testing_strategy"]))
    parts.append(
        "Output ONLY a valid unified diff inside a ```diff fenced block. "
        "Include diff --git, ---/+++, and @@ hunks. No prose essays."
    )
    return "\n\n".join(parts)


def build_act_repair_prompt(*, act_query: str, invalid_response: str) -> str:
    """Second-pass prompt when the model returned prose instead of a diff."""
    excerpt = str(invalid_response or "").strip()[:2000]
    return (
        "Your previous response was REJECTED because it did not contain a valid unified diff.\n"
        "Do NOT repeat explanations. Output ONLY a ```diff block with a git-apply-compatible patch.\n\n"
        f"Original task:\n{act_query.strip()}\n\n"
        f"Invalid response (do not copy this prose):\n{excerpt}\n\n"
        "Now output ONLY the ```diff patch."
    )
