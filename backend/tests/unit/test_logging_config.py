import json
import logging
import pytest

from app.core.logging_config import RequestContextFilter, StructuredFormatter, configure_structured_logging
from app.core.context import set_request_context

def test_request_context_filter():
    filter = RequestContextFilter()
    record = logging.LogRecord("name", logging.INFO, "pathname", 1, "msg", (), None)
    
    set_request_context(
        request_id="req_1",
        correlation_id="corr_1",
        user_id="user_1",
        operation_name="op_1"
    )
    
    assert filter.filter(record)
    assert record.request_id == "req_1"
    assert record.correlation_id == "corr_1"
    assert record.user_id == "user_1"
    assert record.operation_name == "op_1"

def test_structured_formatter():
    formatter = StructuredFormatter()
    record = logging.LogRecord("name", logging.INFO, "pathname", 1, "msg", (), None)
    record.request_id = "req_1"
    record.correlation_id = "corr_1"
    record.user_id = "user_1"
    record.operation_name = "op_1"
    record.extra_data = {"key": "value"}
    
    formatted = formatter.format(record)
    log_obj = json.loads(formatted)
    
    assert log_obj["level"] == "INFO"
    assert log_obj["message"] == "msg"
    assert log_obj["request_id"] == "req_1"
    assert log_obj["correlation_id"] == "corr_1"
    assert log_obj["user_id"] == "user_1"
    assert log_obj["operation_name"] == "op_1"
    assert log_obj["extra"] == {"key": "value"}

def test_structured_formatter_with_exception():
    formatter = StructuredFormatter()
    
    try:
        raise ValueError("test error")
    except ValueError as e:
        import sys
        record = logging.LogRecord("name", logging.ERROR, "pathname", 1, "msg", (), sys.exc_info())
        
    formatted = formatter.format(record)
    log_obj = json.loads(formatted)
    
    assert log_obj["exception"]["type"] == "ValueError"
    assert log_obj["exception"]["message"] == "test error"

def test_configure_structured_logging():
    configure_structured_logging(use_json=True)
    
    root_logger = logging.getLogger()
    assert len(root_logger.handlers) > 0
    
    has_context_filter = False
    for handler in root_logger.handlers:
        if any(isinstance(f, RequestContextFilter) for f in handler.filters):
            has_context_filter = True
            break
            
    assert has_context_filter

def test_configure_structured_logging_non_json():
    configure_structured_logging(use_json=False)
    
    root_logger = logging.getLogger()
    
    has_formatter = False
    for handler in root_logger.handlers:
        if isinstance(handler.formatter, logging.Formatter):
            has_formatter = True
            break
            
    assert has_formatter
