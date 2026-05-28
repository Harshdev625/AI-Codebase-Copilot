import time
import requests

BASE_URL = "http://localhost:8000/v1"

def main():
    # 1. Register
    print("Registering...")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": "test@example.com",
        "password": "Password123!",
        "full_name": "Test User"
    })
    if resp.status_code == 409:
        print("User already registered")
    else:
        resp.raise_for_status()

    # 2. Login
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "test@example.com",
        "password": "Password123!"
    })
    resp.raise_for_status()
    token = resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Add repo
    print("Adding repository...")
    resp = requests.post(f"{BASE_URL}/repositories", headers=headers, json={
        "repo_id": "time-machine",
        "local_path": "e:/Projects/AI Codebase Copilot",
        "default_branch": "main"
    })
    if resp.status_code not in (200, 201):
        if resp.status_code == 409 and "already exists" in resp.text.lower():
            print("Repository already exists")
        else:
            print(resp.text)
            resp.raise_for_status()
    
    # Need repository ID. Let's fetch it
    resp = requests.get(f"{BASE_URL}/repositories", headers=headers)
    resp.raise_for_status()
    repos = resp.json()["data"]["items"]
    repo_id = next((r["id"] for r in repos if r["repo_id"] == "time-machine"), None)
    if not repo_id:
        repo_id = repos[0]["id"]

    print(f"Repository ID: {repo_id}")

    # 4. Start Indexing
    print("Starting indexing...")
    resp = requests.post(f"{BASE_URL}/index", headers=headers, json={
        "repository_id": repo_id,
        "repo_path": "e:/Projects/AI Codebase Copilot"
    })
    if resp.status_code == 409:
        print("Indexing already running.")
        return
    resp.raise_for_status()
    job_id = resp.json()["data"]["indexing_job_id"]
    print(f"Indexing job ID: {job_id}")

    # 5. Poll progress
    while True:
        resp = requests.get(f"{BASE_URL}/index/progress/{job_id}", headers=headers)
        resp.raise_for_status()
        data = resp.json()["data"]
        status = data.get("job_status")
        print(f"Status: {status} - {data.get('stats', {}).get('processed_files', 0)} files processed. Error: {data.get('message')}")
        if status in ("completed", "failed"):
            break
        time.sleep(2)

    print("Done!")

if __name__ == "__main__":
    main()
