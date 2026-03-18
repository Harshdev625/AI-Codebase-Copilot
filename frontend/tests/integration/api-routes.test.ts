import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { POST as postAuthLogin } from "@/app/api/auth/login/route";
import { POST as postAuthRegister } from "@/app/api/auth/register/route";
import { POST as postChat } from "@/app/api/chat/route";
import { GET as getProjects, POST as postProjects } from "@/app/api/projects/route";
import { GET as getProjectRepos, POST as postProjectRepos } from "@/app/api/projects/[projectId]/repositories/route";
import { POST as postIndex } from "@/app/api/index/route";
import { GET as getIndexProgress } from "@/app/api/index/progress/[snapshotId]/route";
import { GET as getAdminUsers } from "@/app/api/admin/users/route";
import { GET as getAdminSystemMetrics } from "@/app/api/admin/system-metrics/route";

jest.mock("@/lib/backend-url", () => ({
  getBackendUrl: jest.fn(() => "http://backend.test/v1"),
}));

describe("Next API route proxies", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("proxies auth login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "token" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@x.com", password: "pass" }),
    });

    const res = await postAuthLogin(req as never);

    expect(global.fetch).toHaveBeenCalledWith("http://backend.test/v1/auth/login", expect.objectContaining({ method: "POST" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ access_token: "token" });
  });

  it("proxies auth register", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u1" }), { status: 201, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@x.com", password: "pass12345" }),
    });

    const res = await postAuthRegister(req as never);

    expect(global.fetch).toHaveBeenCalledWith("http://backend.test/v1/auth/register", expect.objectContaining({ method: "POST" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: "u1" });
  });

  it("proxies auth me with authorization header", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u1", role: "developer" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer abc" },
    });

    const res = await getAuthMe(req as never);

    expect(global.fetch).toHaveBeenCalledWith("http://backend.test/v1/auth/me", {
      headers: { Authorization: "Bearer abc" },
    });
    expect(res.status).toBe(200);
  });

  it("proxies chat endpoint", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ answer: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer abc" },
      body: JSON.stringify({ repo_id: "repo-1", query: "hello" }),
    });

    const res = await postChat(req as never);

    expect(global.fetch).toHaveBeenCalledWith("http://backend.test/v1/chat", expect.objectContaining({ method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("proxies projects GET and POST", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "p1", name: "Project 1" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "p2", name: "Project 2" }), { status: 201, headers: { "Content-Type": "application/json" } }));

    const getReq = new Request("http://localhost/api/projects", { headers: { Authorization: "Bearer z" } });
    const getRes = await getProjects(getReq as never);

    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toEqual([{ id: "p1", name: "Project 1" }]);

    const postReq = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer z" },
      body: JSON.stringify({ name: "Project 2" }),
    });
    const postRes = await postProjects(postReq as never);

    expect(postRes.status).toBe(201);
    await expect(postRes.json()).resolves.toEqual({ id: "p2", name: "Project 2" });
  });

  it("proxies project repositories GET and POST", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "r1", repo_id: "repo-1" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "r2", repo_id: "repo-2" }), { status: 201, headers: { "Content-Type": "application/json" } }));

    const context = { params: Promise.resolve({ projectId: "p1" }) };

    const getReq = new Request("http://localhost/api/projects/p1/repositories", {
      headers: { Authorization: "Bearer repo" },
    });
    const getRes = await getProjectRepos(getReq as never, context);
    expect(getRes.status).toBe(200);

    const postReq = new Request("http://localhost/api/projects/p1/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer repo" },
      body: JSON.stringify({ repo_id: "repo-2", remote_url: "https://github.com/o/r.git", default_branch: "main" }),
    });
    const postRes = await postProjectRepos(postReq as never, context);
    expect(postRes.status).toBe(201);
  });

  it("proxies index request", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ snapshot_id: "snap-1" }), { status: 202, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/index", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer abc" },
      body: JSON.stringify({ repo_id: "repo-1", repo_url: "https://github.com/o/r.git" }),
    });

    const res = await postIndex(req as never);

    expect(global.fetch).toHaveBeenCalledWith("http://backend.test/v1/index", expect.objectContaining({ method: "POST" }));
    expect(res.status).toBe(202);
  });

  it("returns progress data for index progress route", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ index_status: "completed", stats: { indexed_chunks: 10 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const req = new Request("http://localhost/api/index/progress/snap-1", {
      headers: { Authorization: "Bearer abc" },
    });
    const res = await getIndexProgress(req as never, { params: Promise.resolve({ snapshotId: "snap-1" }) });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://backend.test/v1/index/progress/snap-1",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ index_status: "completed", stats: { indexed_chunks: 10 } });
  });

  it("returns 500 from index progress route when fetch throws", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("backend down"));

    const req = new Request("http://localhost/api/index/progress/snap-1", {
      headers: { Authorization: "Bearer abc" },
    });
    const res = await getIndexProgress(req as never, { params: Promise.resolve({ snapshotId: "snap-1" }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to fetch progress" });
  });

  it("proxies admin users and system metrics", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "u1", email: "admin@x.com" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users_count: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const req = new Request("http://localhost/api/admin/users", {
      headers: { Authorization: "Bearer adm" },
    });
    const usersRes = await getAdminUsers(req as never);
    expect(usersRes.status).toBe(200);

    const metricsReq = new Request("http://localhost/api/admin/system-metrics", {
      headers: { Authorization: "Bearer adm" },
    });
    const metricsRes = await getAdminSystemMetrics(metricsReq as never);
    expect(metricsRes.status).toBe(200);
  });
});
