from __future__ import annotations

import re
import uuid

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session


_CALL_PATTERN = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(")
_IMPORT_PATTERN = re.compile(r"\b(?:from|import)\s+([A-Za-z_][A-Za-z0-9_\.]*)")
_IDENT_PATTERN = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\b")

_STOP_TOKENS = {
    "if",
    "else",
    "for",
    "while",
    "return",
    "class",
    "def",
    "async",
    "await",
    "try",
    "except",
    "finally",
    "import",
    "from",
    "true",
    "false",
    "none",
    "null",
    "this",
    "self",
    "super",
    "new",
    "const",
    "let",
    "var",
}


def _extract_references(content: str) -> list[tuple[str, str, float]]:
    references: list[tuple[str, str, float]] = []

    for token in _CALL_PATTERN.findall(content):
        low = token.lower()
        if low in _STOP_TOKENS:
            continue
        references.append((low, "call", 1.0))

    for token in _IMPORT_PATTERN.findall(content):
        head = token.split(".")[0].strip().lower()
        if not head or head in _STOP_TOKENS:
            continue
        references.append((head, "import", 1.2))

    if len(references) < 12:
        for token in _IDENT_PATTERN.findall(content):
            low = token.lower()
            if low in _STOP_TOKENS or len(low) < 3:
                continue
            references.append((low, "identifier", 0.35))
            if len(references) >= 32:
                break

    return references[:48]


def rebuild_code_graph(session: Session, repo_id: str) -> int:
    rows = session.execute(
        text("SELECT id, symbol, content FROM code_chunks WHERE repo_id = :repo_id"),
        {"repo_id": repo_id},
    ).mappings().all()

    session.execute(
        text("DELETE FROM code_graph_edges WHERE repo_id = :repo_id"),
        {"repo_id": repo_id},
    )

    symbol_to_chunk_ids: dict[str, set[str]] = {}
    for row in rows:
        symbol = str(row.get("symbol") or "").strip().lower()
        if not symbol:
            continue
        symbol_to_chunk_ids.setdefault(symbol, set()).add(str(row["id"]))

    insert_stmt = text(
        """
        INSERT INTO code_graph_edges (
          id, repo_id, source_chunk_id, target_chunk_id, edge_type, weight
        ) VALUES (
          :id, :repo_id, :source_chunk_id, :target_chunk_id, :edge_type, :weight
        )
        ON CONFLICT (repo_id, source_chunk_id, target_chunk_id, edge_type)
        DO UPDATE SET weight = GREATEST(code_graph_edges.weight, EXCLUDED.weight)
        """
    )

    inserted = 0
    for row in rows:
        source_chunk_id = str(row["id"])
        content = str(row.get("content") or "")
        references = _extract_references(content)
        if not references:
            continue

        seen_pairs: set[tuple[str, str]] = set()
        for token, edge_type, weight in references:
            for target_chunk_id in symbol_to_chunk_ids.get(token, set()):
                if target_chunk_id == source_chunk_id:
                    continue
                pair = (target_chunk_id, edge_type)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)

                edge_id = str(
                    uuid.uuid5(
                        uuid.NAMESPACE_OID,
                        f"{repo_id}|{source_chunk_id}|{target_chunk_id}|{edge_type}",
                    )
                )
                session.execute(
                    insert_stmt,
                    {
                        "id": edge_id,
                        "repo_id": repo_id,
                        "source_chunk_id": source_chunk_id,
                        "target_chunk_id": target_chunk_id,
                        "edge_type": edge_type,
                        "weight": weight,
                    },
                )
                inserted += 1

                if len(seen_pairs) >= 24:
                    break
            if len(seen_pairs) >= 24:
                break

    session.commit()
    return inserted


def graph_expand_context(session: Session, repo_id: str, seed_chunk_ids: list[str], limit: int = 12) -> list[dict]:
    if not seed_chunk_ids:
        return []

    stmt = (
        text(
            """
            SELECT
              c.id,
              c.path,
              c.symbol,
              c.content,
              MAX(e.weight) AS score
            FROM code_graph_edges e
            JOIN code_chunks c ON c.id = e.target_chunk_id
            WHERE e.repo_id = :repo_id
              AND e.source_chunk_id IN :seed_ids
              AND e.target_chunk_id NOT IN :seed_ids
            GROUP BY c.id, c.path, c.symbol, c.content
            ORDER BY score DESC
            LIMIT :limit
            """
        )
        .bindparams(bindparam("seed_ids", expanding=True))
    )
    rows = session.execute(
        stmt,
        {
            "repo_id": repo_id,
            "seed_ids": seed_chunk_ids,
            "limit": limit,
        },
    ).mappings()
    return [dict(row) for row in rows]
