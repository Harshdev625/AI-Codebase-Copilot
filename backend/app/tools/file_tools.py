from pathlib import Path


def read_file(path: str, max_chars: int = 10_000) -> str:
    content = Path(path).read_text(encoding="utf-8", errors="ignore")
    return content[:max_chars]
