"""Unit tests for standardized API response helpers."""

from unittest.mock import patch

import pytest
from fastapi.responses import JSONResponse

from app.core.api_response import error_response, paginated_success_response, success_response


@pytest.fixture(autouse=True)
def _request_id():
    with patch("app.core.api_response.get_request_id", return_value="req-test-123"):
        yield


def test_success_response_shape():
    resp = success_response({"id": 1, "name": "alpha"})
    assert isinstance(resp, JSONResponse)
    assert resp.status_code == 200
    body = resp.body.decode()
    assert '"success":true' in body.replace(" ", "")
    assert '"id":1' in body.replace(" ", "")
    assert "req-test-123" in body
    assert "timestamp" in body


def test_success_response_custom_status():
    resp = success_response([], status_code=201)
    assert resp.status_code == 201


def test_paginated_success_response_has_more():
    resp = paginated_success_response(items=[1, 2], total=5, limit=2, offset=0)
    body = resp.body.decode()
    assert '"has_more":true' in body.replace(" ", "")


def test_paginated_success_response_no_more():
    resp = paginated_success_response(items=[1, 2], total=2, limit=10, offset=0)
    body = resp.body.decode()
    assert '"has_more":false' in body.replace(" ", "")


def test_error_response_uses_http_phrase():
    resp = error_response("Not found", 404)
    assert resp.status_code == 404
    body = resp.body.decode()
    assert '"success":false' in body.replace(" ", "")
    assert "Not Found" in body
    assert "Not found" in body


def test_error_response_custom_code_and_details():
    resp = error_response(
        "Validation failed",
        422,
        error="VALIDATION_ERROR",
        details={"field": "email"},
    )
    body = resp.body.decode()
    assert "VALIDATION_ERROR" in body
    assert "email" in body


def test_error_response_unknown_status_code():
    resp = error_response("Custom", 599)
    body = resp.body.decode()
    assert "Error" in body
