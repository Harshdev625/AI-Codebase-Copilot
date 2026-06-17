import logging
import re
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def apply_diff_to_codebase(repo_path: Path, diff: str) -> None:
    """Applies a unified diff patch to the given codebase using git apply."""
    try:
        process = subprocess.run(
            ["git", "apply", "--ignore-space-change", "--ignore-whitespace"],
            input=diff.encode("utf-8"),
            cwd=str(repo_path),
            capture_output=True,
        )
        if process.returncode != 0:
            error_msg = process.stderr.decode("utf-8")
            logger.error(f"Failed to apply patch: {error_msg}")
            raise RuntimeError(f"Patch application failed: {error_msg}")
    except FileNotFoundError:
        raise RuntimeError("git is not installed or available in PATH")
    except Exception as exc:
        raise RuntimeError(f"Unexpected error applying patch: {str(exc)}") from exc


def split_unified_diff(diff: str) -> dict[str, str]:
    """Split a multi-file unified diff into per-file patch strings."""
    text = diff.replace("\r\n", "\n").strip()
    if not text:
        return {}

    blocks = re.split(r"(?=^diff --git )", text, flags=re.MULTILINE)
    per_file: dict[str, str] = {}
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        path = ""
        for line in block.splitlines():
            if line.startswith("+++ b/"):
                path = line[6:].strip()
                break
            if line.startswith("--- a/") and not path:
                path = line[6:].strip()
        if path:
            per_file[path] = block
    if not per_file and text.startswith("---"):
        per_file["patch.diff"] = text
    return per_file


def apply_unified_diff(original: str, patch: str) -> str:
    """Apply a single-file unified diff to original text in memory."""
    original_lines = original.splitlines()
    patch_lines = patch.replace("\r\n", "\n").splitlines()
    output: list[str] = []
    orig_idx = 0
    i = 0
    hunk_header = re.compile(r"^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@")

    while i < len(patch_lines):
        line = patch_lines[i]
        if line.startswith("---") or line.startswith("+++"):
            i += 1
            continue
        if hunk_header.match(line):
            m = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            i += 1
            if not m:
                continue
            old_start = max(int(m.group(1)) - 1, 0)
            while orig_idx < old_start and orig_idx < len(original_lines):
                output.append(original_lines[orig_idx])
                orig_idx += 1
            while i < len(patch_lines):
                hline = patch_lines[i]
                if hunk_header.match(hline):
                    break
                if hline.startswith(" "):
                    if orig_idx < len(original_lines):
                        output.append(original_lines[orig_idx])
                        orig_idx += 1
                    i += 1
                elif hline.startswith("-"):
                    orig_idx += 1
                    i += 1
                elif hline.startswith("+"):
                    output.append(hline[1:])
                    i += 1
                elif hline.startswith("\\"):
                    i += 1
                else:
                    i += 1
            continue
        i += 1

    while orig_idx < len(original_lines):
        output.append(original_lines[orig_idx])
        orig_idx += 1
    return "\n".join(output)
