import httpx
import sys
import uuid

base_url = "http://127.0.0.1:8000/v1"
local_path = r"e:\Projects\AI Codebase Copilot"

def check():
    email = f"verify-{uuid.uuid4().hex[:6]}@test.com"
    password = "StrongPassword123!"

    print(f"1. Registering {email}...")
    resp = httpx.post(f"{base_url}/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Verifier"
    })
    resp.raise_for_status()

    print("2. Logging in...")
    resp = httpx.post(f"{base_url}/auth/login", json={
        "email": email,
        "password": password
    })
    token = resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("3. Creating project...")
    resp = httpx.post(f"{base_url}/projects", headers=headers, json={
        "name": "Verification Project"
    })
    project_id = resp.json()["data"]["id"]

    print("4. Adding repository...")
    resp = httpx.post(f"{base_url}/projects/{project_id}/repositories", headers=headers, json={
        "repo_id": "local/verify-repo",
        "local_path": local_path
    })
    repository_id = resp.json()["data"]["id"]

    print("5. Triggering indexing...")
    resp = httpx.post(f"{base_url}/index", headers=headers, json={
        "repository_id": repository_id
    })
    resp.raise_for_status()
    snapshot_id = resp.json()["data"]["snapshot_id"]
    print(f"   Snapshot ID: {snapshot_id}")

    print("6. Waiting for indexing (should be fast for cached files)...")
    import time
    for _ in range(60):
        resp = httpx.get(f"{base_url}/index/progress/{snapshot_id}", headers=headers)
        resp.raise_for_status()
        data = resp.json()["data"]
        status = data["index_status"]
        if status == "completed":
            break
        print(f"   Status: {status} ({data.get('percentage', 0)}%)...")
        time.sleep(2)

    print("7. Chatting...")
    resp = httpx.post(f"{base_url}/chat", headers=headers, json={
        "repository_id": repository_id,
        "query": "Briefly describe the vector dimension used in this app."
    }, timeout=600.0)
    
    data = resp.json()
    if not data.get("success"):
        print("Chat failed:", data.get("error"))
    else:
        print("\nSUCCESS!")
        print("Intent:", data["data"]["intent"])
        print("Answer:", data["data"]["answer"][:500])
        print("Sources found:", len(data["data"]["sources"]))

if __name__ == "__main__":
    check()
