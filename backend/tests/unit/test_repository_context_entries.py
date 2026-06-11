import pytest
from datetime import datetime, timedelta
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
    return test_user, repo

def test_create_get_delete_context_endpoints(client, auth_headers, test_setup, db_session):
    user, repo = test_setup

    session_id = "session-abc"
    
    # 1. Create context entry
    payload = {
        "repository_id": repo.id,
        "path": "src/main.py",
        "entry_type": "FILE",
        "token_count": 1000,
        "is_pinned": False,
        "priority": 1,
        "expires_at": (datetime.utcnow() + timedelta(days=1)).isoformat()
    }
    
    response = client.post(
        f"/v1/sessions/{session_id}/context",
        json=payload,
        headers=auth_headers
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["session_id"] == session_id
    assert data["path"] == "src/main.py"
    assert data["token_count"] == 1000
    entry_id = data["id"]

    # 2. Get session context
    response = client.get(
        f"/v1/sessions/{session_id}/context",
        headers=auth_headers
    )
    assert response.status_code == 200
    entries = response.json()["data"]["entries"]
    assert len(entries) == 1
    assert entries[0]["id"] == entry_id

    # 3. Delete context entry
    response = client.delete(
        f"/v1/sessions/{session_id}/context/{entry_id}",
        headers=auth_headers
    )
    assert response.status_code == 200

    # 4. Verify deletion
    response = client.get(
        f"/v1/sessions/{session_id}/context",
        headers=auth_headers
    )
    assert response.status_code == 200
    entries = response.json()["data"]["entries"]
    assert len(entries) == 0

def test_context_budgeting_pruning_expired(client, auth_headers, test_setup, db_session):
    user, repo = test_setup
    session_id = "session-prune-1"

    # Add expired entry
    expired_time = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    payload = {
        "repository_id": repo.id,
        "path": "src/expired.py",
        "entry_type": "FILE",
        "token_count": 100000,
        "is_pinned": False,
        "priority": 0,
        "expires_at": expired_time
    }
    response = client.post(f"/v1/sessions/{session_id}/context", json=payload, headers=auth_headers)
    assert response.status_code == 200

    # Add entry that pushes total over 120,000
    payload2 = {
        "repository_id": repo.id,
        "path": "src/active.py",
        "entry_type": "FILE",
        "token_count": 30000,
        "is_pinned": False,
        "priority": 1
    }
    response = client.post(f"/v1/sessions/{session_id}/context", json=payload2, headers=auth_headers)
    assert response.status_code == 200
    
    # Verify that the expired entry was deleted first during pruning (retaining active.py)
    response = client.get(f"/v1/sessions/{session_id}/context", headers=auth_headers)
    entries = response.json()["data"]["entries"]
    assert len(entries) == 1
    assert entries[0]["path"] == "src/active.py"

def test_context_budgeting_pruning_priority_and_age(client, auth_headers, test_setup, db_session):
    user, repo = test_setup
    session_id = "session-prune-2"

    # We insert several items:
    # 1. Pinned entry (should never be pruned) - 50,000 tokens
    client.post(f"/v1/sessions/{session_id}/context", json={
        "repository_id": repo.id,
        "path": "src/pinned.py",
        "entry_type": "FILE",
        "token_count": 50000,
        "is_pinned": True,
        "priority": 0
    }, headers=auth_headers)

    # 2. Priority 1 entry (oldest) - 30,000 tokens
    client.post(f"/v1/sessions/{session_id}/context", json={
        "repository_id": repo.id,
        "path": "src/old_pri1.py",
        "entry_type": "FILE",
        "token_count": 30000,
        "is_pinned": False,
        "priority": 1
    }, headers=auth_headers)

    # 3. Priority 1 entry (newest) - 30,000 tokens
    client.post(f"/v1/sessions/{session_id}/context", json={
        "repository_id": repo.id,
        "path": "src/new_pri1.py",
        "entry_type": "FILE",
        "token_count": 30000,
        "is_pinned": False,
        "priority": 1
    }, headers=auth_headers)

    # Total currently = 110,000 tokens. Adding 20,000 more pushes to 130,000 (> 120,000).
    # This triggers pruning to <= 96,000 tokens (80% of 120,000).
    # Since src/pinned.py (50k) is pinned, we look at the others:
    # - lowest priority: they both have priority 1.
    # - oldest: src/old_pri1.py (30k) was added first.
    # Evicting src/old_pri1.py drops total to 50k + 30k + 20k = 100k (>96k).
    # Thus, the pruning algorithm must also prune src/new_pri1.py (30k), bringing total to 50k + 20k = 70k (<= 96k).
    # Pinned remains, plus the new added entry.
    
    response = client.post(f"/v1/sessions/{session_id}/context", json={
        "repository_id": repo.id,
        "path": "src/newest.py",
        "entry_type": "FILE",
        "token_count": 20000,
        "is_pinned": False,
        "priority": 2
    }, headers=auth_headers)
    assert response.status_code == 200

    response = client.get(f"/v1/sessions/{session_id}/context", headers=auth_headers)
    entries = response.json()["data"]["entries"]
    paths = {e["path"] for e in entries}
    
    assert "src/pinned.py" in paths
    assert "src/newest.py" in paths
    assert "src/old_pri1.py" not in paths
    assert "src/new_pri1.py" not in paths
