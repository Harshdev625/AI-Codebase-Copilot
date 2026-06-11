import pytest
from app.db import models as db_models

@pytest.fixture
def test_setup(db_session, test_user):
    repo = db_models.Repository(
        id="repo-123",
        owner_user_id=test_user["id"],
        repo_id="test-repo",
        remote_url="https://github.com/test/repo.git",
        default_branch="main"
    )
    db_session.add(repo)
    db_session.commit()

    # Add several files at different levels
    files = [
        # Root files
        db_models.RepositoryFile(
            id="f1", repository_id=repo.id, path="README.md", type="FILE",
            extension="md", language="markdown", size_bytes=100, status="INDEXED"
        ),
        db_models.RepositoryFile(
            id="f2", repository_id=repo.id, path="package.json", type="FILE",
            extension="json", language="json", size_bytes=200, status="INDEXED"
        ),
        # Files in src/
        db_models.RepositoryFile(
            id="f3", repository_id=repo.id, path="src/main.py", type="FILE",
            extension="py", language="python", size_bytes=500, status="INDEXED"
        ),
        db_models.RepositoryFile(
            id="f4", repository_id=repo.id, path="src/utils.py", type="FILE",
            extension="py", language="python", size_bytes=300, status="INDEXED"
        ),
        # File in src/core/
        db_models.RepositoryFile(
            id="f5", repository_id=repo.id, path="src/core/engine.py", type="FILE",
            extension="py", language="python", size_bytes=800, status="INDEXED"
        ),
        # File in tests/
        db_models.RepositoryFile(
            id="f6", repository_id=repo.id, path="tests/test_main.py", type="FILE",
            extension="py", language="python", size_bytes=400, status="INDEXED"
        ),
    ]
    for f in files:
        db_session.add(f)
    db_session.commit()
    return test_user, repo

def test_lazy_tree_root(client, auth_headers, test_setup):
    user, repo = test_setup

    # Query root tree
    response = client.get(
        f"/v1/repositories/{repo.id}/tree",
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    items = response.json()["data"]["items"]
    
    # Root direct children should be:
    # - README.md (FILE)
    # - package.json (FILE)
    # - src (DIRECTORY)
    # - tests (DIRECTORY)
    paths = {item["path"] for item in items}
    assert paths == {"README.md", "package.json", "src", "tests"}
    
    types = {item["path"]: item["type"] for item in items}
    assert types["README.md"] == "FILE"
    assert types["src"] == "DIRECTORY"

def test_lazy_tree_src_directory(client, auth_headers, test_setup):
    user, repo = test_setup

    # Query src directory tree
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?path=src",
        headers=auth_headers
    )
    assert response.status_code == 200
    items = response.json()["data"]["items"]

    # src direct children should be:
    # - src/main.py (FILE)
    # - src/utils.py (FILE)
    # - src/core (DIRECTORY)
    paths = {item["path"] for item in items}
    assert paths == {"src/main.py", "src/utils.py", "src/core"}
    
    types = {item["path"]: item["type"] for item in items}
    assert types["src/main.py"] == "FILE"
    assert types["src/core"] == "DIRECTORY"

def test_lazy_tree_pagination(client, auth_headers, test_setup):
    user, repo = test_setup

    # Query root tree with limit=2
    # Alphabetical order: README.md, package.json, src, tests
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?limit=2",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()["data"]
    items = data["items"]
    assert len(items) == 2
    assert items[0]["path"] == "README.md"
    assert items[1]["path"] == "package.json"
    
    next_cursor = data["next_cursor"]
    assert next_cursor is not None

    # Query with next_cursor
    response = client.get(
        f"/v1/repositories/{repo.id}/tree?limit=2&cursor={next_cursor}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()["data"]
    items = data["items"]
    assert len(items) == 2
    assert items[0]["path"] == "src"
    assert items[1]["path"] == "tests"
