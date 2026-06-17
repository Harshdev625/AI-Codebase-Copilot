from __future__ import annotations

from typing import Any

from app.models.api_models import TraceStep


def trace_step_payload(
    entry: dict[str, Any],
    *,
    stage: str = "pipeline",
    status: str = "done",
) -> dict[str, Any]:
    step = TraceStep.from_run_trace_entry(entry, stage=stage, status=status)  # type: ignore[arg-type]
    return step.model_dump(exclude_none=True)


def pipeline_status_events(entry: dict[str, Any]) -> list[dict[str, Any]]:
    label = str(entry.get("label") or "")
    step = trace_step_payload(entry, stage="pipeline", status="done")
    events: list[dict[str, Any]] = [
        {"type": "status", "step": label, "stage": "pipeline"},
        {"type": "trace_step", "step": step},
    ]
    return events


def llm_status_events(label: str = "Generating answer") -> list[dict[str, Any]]:
    step = trace_step_payload(
        {
            "node": "llm",
            "label": label,
            "detail": {},
        },
        stage="llm",
        status="running",
    )
    return [
        {"type": "status", "step": label, "stage": "llm"},
        {"type": "trace_step", "step": step},
    ]


def source_events(sources: list[dict[str, Any]], *, limit: int = 8) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for source in sources[:limit]:
        if isinstance(source, dict):
            events.append({"type": "source", "source": source})
    return events
