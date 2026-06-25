import threading
import time
import pytest
from unittest.mock import MagicMock, patch
from app.services.cache_service import get_cache_service, CacheService
from app.core.exceptions import ExternalServiceError
from app.observability.metrics import runtime_metrics

@pytest.fixture
def mock_redis_client():
    client = MagicMock()
    # Mocking lock behavior
    lock_mock = MagicMock()
    lock_mock.acquire.return_value = True
    client.lock.return_value = lock_mock
    return client

def test_single_lock_acquisition_success(mock_redis_client):
    with patch("app.services.cache_service._get_redis_client", return_value=mock_redis_client):
        # Clear metrics
        runtime_metrics._counters.clear()
        
        cache = CacheService()
        assert cache.is_available
        
        with cache.repository_lock("repo-123", lock_timeout=10):
            # inside lock
            pass
            
        attempts_key = runtime_metrics._series_key("redis_lock_acquire_attempts", {"repository_id": "repo-123"})
        success_key = runtime_metrics._series_key("redis_lock_acquire_success", {"repository_id": "repo-123"})
        assert runtime_metrics._counters.get(attempts_key) == 1
        assert runtime_metrics._counters.get(success_key) == 1

def test_lock_failure_in_production(mock_redis_client):
    # Mock Redis unavailable and env as production
    with patch("app.services.cache_service._get_redis_client", return_value=None), \
         patch("app.services.cache_service.settings") as mock_settings:
         
        mock_settings.is_production_like = True
         
        cache = CacheService()
        assert not cache.is_available
        
        with pytest.raises(ExternalServiceError) as exc_info:
            with cache.repository_lock("repo-123"):
                pass
        assert "Redis lock is unavailable" in exc_info.value.details["error"]

def test_lock_fallback_in_development():
    # Mock Redis unavailable and env as development
    with patch("app.services.cache_service._get_redis_client", return_value=None), \
         patch("app.services.cache_service.settings") as mock_settings:
         
        mock_settings.is_production_like = False
         
        cache = CacheService()
        assert not cache.is_available
        
        # In development, it should use fallback lock and succeed
        with cache.repository_lock("repo-123"):
            pass

def test_concurrent_lock_queues():
    # Test threading fallback locks sequential coordination when Redis is down in dev mode
    with patch("app.services.cache_service._get_redis_client", return_value=None), \
         patch("app.services.cache_service.settings") as mock_settings:
         
        mock_settings.is_production_like = False
         
        cache = CacheService()
        assert not cache.is_available
        
        order = []
        def job1():
            with cache.repository_lock("repo-concurrent", lock_timeout=2, acquire_timeout=1):
                order.append("job1-start")
                time.sleep(0.2)
                order.append("job1-end")
                
        def job2():
            time.sleep(0.05)
            with cache.repository_lock("repo-concurrent", lock_timeout=2, acquire_timeout=1):
                order.append("job2-start")
                
        t1 = threading.Thread(target=job1)
        t2 = threading.Thread(target=job2)
        
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # Due to lock sequential coordination, job 2 should start only after job 1 finishes
        assert "job1-start" in order
        assert "job1-end" in order
        assert "job2-start" in order
        assert order.index("job1-end") < order.index("job2-start")
