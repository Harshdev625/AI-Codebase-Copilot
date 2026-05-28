from unittest.mock import MagicMock, patch
import httpx
import pytest

from app.services.qdrant_service import QdrantService
from app.core.exceptions import ExternalServiceError

@pytest.fixture
def mock_http_client():
    with patch("app.services.qdrant_service.get_http_client") as mock:
        client = MagicMock()
        mock.return_value = client
        yield client

@pytest.fixture
def qdrant_service():
    return QdrantService()

def test_ensure_collection_success(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_http_client.put.return_value = mock_response

    qdrant_service.ensure_collection()
    mock_http_client.put.assert_called_once()
    assert mock_response.raise_for_status.call_count == 1

def test_ensure_collection_exists(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_response.status_code = 409
    mock_http_client.put.return_value = mock_response

    qdrant_service.ensure_collection()
    mock_http_client.put.assert_called_once()
    assert mock_response.raise_for_status.call_count == 0

def test_ensure_collection_failure(mock_http_client, qdrant_service):
    mock_http_client.put.side_effect = httpx.HTTPStatusError("Error", request=MagicMock(), response=MagicMock())

    with pytest.raises(ExternalServiceError):
        qdrant_service.ensure_collection()

def test_upsert_points_success(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_http_client.put.return_value = mock_response

    points = [{"id": "1", "vector": [0.1, 0.2]}]
    qdrant_service.upsert_points(points)

    mock_http_client.put.assert_called_once()
    assert mock_response.raise_for_status.call_count == 1

def test_upsert_points_empty(mock_http_client, qdrant_service):
    qdrant_service.upsert_points([])
    mock_http_client.put.assert_not_called()

def test_upsert_points_failure(mock_http_client, qdrant_service):
    mock_http_client.put.side_effect = httpx.HTTPStatusError("Error", request=MagicMock(), response=MagicMock())

    points = [{"id": "1", "vector": [0.1, 0.2]}]
    with pytest.raises(ExternalServiceError):
        qdrant_service.upsert_points(points)

def test_delete_points_by_ids_success(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_http_client.post.return_value = mock_response

    point_ids = ["1", "2"]
    qdrant_service.delete_points_by_ids(point_ids)

    mock_http_client.post.assert_called_once()
    assert mock_response.raise_for_status.call_count == 1

def test_delete_points_by_ids_empty(mock_http_client, qdrant_service):
    qdrant_service.delete_points_by_ids([])
    mock_http_client.post.assert_not_called()

def test_delete_points_by_ids_failure(mock_http_client, qdrant_service):
    mock_http_client.post.side_effect = httpx.HTTPStatusError("Error", request=MagicMock(), response=MagicMock())

    point_ids = ["1", "2"]
    with pytest.raises(ExternalServiceError):
        qdrant_service.delete_points_by_ids(point_ids)

def test_delete_points_by_repository_success(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_http_client.post.return_value = mock_response

    qdrant_service.delete_points_by_repository("repo_1")

    mock_http_client.post.assert_called_once()
    assert mock_response.raise_for_status.call_count == 1

def test_delete_points_by_repository_failure(mock_http_client, qdrant_service):
    mock_http_client.post.side_effect = httpx.HTTPStatusError("Error", request=MagicMock(), response=MagicMock())

    with pytest.raises(ExternalServiceError):
        qdrant_service.delete_points_by_repository("repo_1")

def test_search_success(mock_http_client, qdrant_service):
    mock_response = MagicMock()
    mock_response.json.return_value = {"result": [{"id": "1", "score": 0.9}]}
    mock_http_client.post.return_value = mock_response

    results = qdrant_service.search([0.1, 0.2], "repo_1", 10)

    mock_http_client.post.assert_called_once()
    assert mock_response.raise_for_status.call_count == 1
    assert len(results) == 1
    assert results[0]["id"] == "1"

def test_search_failure(mock_http_client, qdrant_service):
    mock_http_client.post.side_effect = httpx.HTTPStatusError("Error", request=MagicMock(), response=MagicMock())

    with pytest.raises(ExternalServiceError):
        qdrant_service.search([0.1, 0.2], "repo_1", 10)
