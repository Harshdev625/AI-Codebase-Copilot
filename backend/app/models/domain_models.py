from dataclasses import dataclass, field


@dataclass
class CodeChunk:
    id: str
    repo_id: str
    commit_sha: str
    path: str
    language: str
    symbol: str
    chunk_type: str
    start_line: int
    end_line: int
    content: str
    metadata: dict = field(default_factory=dict)
