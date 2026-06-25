"""Unit tests for request context helpers."""

from app.core.context import (
    clear_request_context,
    get_correlation_id,
    get_operation_name,
    get_request_context,
    get_request_id,
    get_user_id,
    set_request_context,
)


def setup_function():
    clear_request_context()


def teardown_function():
    clear_request_context()


def test_set_and_get_request_context():
    set_request_context(
        request_id="req-1",
        correlation_id="corr-1",
        user_id="user-1",
        operation_name="chat.stream",
    )
    ctx = get_request_context()
    assert ctx["request_id"] == "req-1"
    assert ctx["correlation_id"] == "corr-1"
    assert ctx["user_id"] == "user-1"
    assert ctx["operation_name"] == "chat.stream"


def test_correlation_defaults_to_request_id():
    set_request_context(request_id="req-2")
    assert get_correlation_id() == "req-2"
    assert get_request_id() == "req-2"


def test_getters_return_none_when_unset():
    assert get_request_id() is None
    assert get_user_id() is None
    assert get_operation_name() is None


def test_clear_request_context():
    set_request_context(request_id="req-3", user_id="user-3")
    clear_request_context()
    assert get_request_context() == {
        "request_id": None,
        "correlation_id": None,
        "user_id": None,
        "operation_name": None,
    }
