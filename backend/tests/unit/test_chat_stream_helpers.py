from app.api.v1.chat_stream_helpers import pipeline_status_events, source_events, trace_step_payload
from app.models.api_models import TraceStep


def test_trace_step_payload_from_run_trace_entry() -> None:
    payload = trace_step_payload(
        {
            "node": "reasoning",
            "label": "Reasoning (confidence 75%)",
            "detail": {"confidence": 0.75, "retrieved_count": 3},
        }
    )
    step = TraceStep.model_validate(payload)
    assert step.node == "reasoning"
    assert step.detail is not None
    assert step.detail.confidence == 0.75


def test_pipeline_status_events_include_status_and_trace_step() -> None:
    events = pipeline_status_events(
        {"node": "planner", "label": "Planning intent: search", "detail": {"intent": "search"}}
    )
    assert events[0]["type"] == "status"
    assert events[1]["type"] == "trace_step"
    assert events[1]["step"]["node"] == "planner"


def test_source_events_limits_sources() -> None:
    events = source_events([{"path": f"f{i}.py", "content": "x"} for i in range(12)], limit=3)
    assert len(events) == 3
    assert events[0]["type"] == "source"
