from pathlib import Path

from app.core.config import settings
from app.services.repository_cache import repo_cache_root, repository_cache_dir, slugify_repo_id


def test_repo_cache_path_is_absolute_under_backend():
    cache = Path(settings.repo_cache_path)
    assert cache.is_absolute()
    assert cache.name == ".repo_cache"


def test_repository_cache_dir_slug():
    path = repository_cache_dir("harshdev625/timemachine")
    assert path.parent == repo_cache_root()
    assert path.name == slugify_repo_id("harshdev625/timemachine")
