import { test, expect, type Page } from "@playwright/test";

const ACCESS_TOKEN_KEY = "tm.access_token";
const USER_KEY = "tm.user";

function buildTestJwt(expOffsetSec = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expOffsetSec,
      sub: "e2e-user",
      role: "USER",
    }),
  ).toString("base64url");
  return `${header}.${payload}.e2e-signature`;
}

async function authenticatePage(page: Page, baseURL: string): Promise<void> {
  const token = buildTestJwt();
  const origin = new URL(baseURL).origin;

  await page.context().addCookies([
    { name: "tm_token", value: token, url: origin, sameSite: "Lax" },
    { name: "tm_role", value: "USER", url: origin, sameSite: "Lax" },
  ]);

  await page.addInitScript(
    ({ tokenKey, userKey, accessToken }) => {
      window.localStorage.setItem(tokenKey, accessToken);
      window.localStorage.setItem(
        userKey,
        JSON.stringify({
          id: "e2e-user",
          email: "e2e@example.com",
          role: "USER",
          is_active: true,
        }),
      );
    },
    { tokenKey: ACCESS_TOKEN_KEY, userKey: USER_KEY, accessToken: token },
  );
}

async function mockAuthMe(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "e2e-user",
          email: "e2e@example.com",
          role: "USER",
          is_active: true,
          token_scopes: ["repository:read", "repository:write", "chat:query"],
        },
      }),
    });
  });
}

test.describe("Engineering Studio E2E Tests", () => {
  test.describe.configure({ timeout: 180_000 });

  const gotoStudio = (page: Page, path: string) =>
    page.goto(path, { waitUntil: "domcontentloaded", timeout: 120_000 });

  async function waitForRepositoryReady(page: Page) {
    await expect(page.getByText("Select a repository to browse files.")).not.toBeVisible({
      timeout: 30_000,
    });
  }

  const repositoryId = "repo-123";
  const patchId = "patch-456";

  test.beforeEach(async ({ page, baseURL }) => {
    await authenticatePage(page, baseURL ?? "http://127.0.0.1:3000");
    await mockAuthMe(page);
    await page.route("**/api/v1/repositories*", async (route) => {
      const url = route.request().url();
      const isList =
        route.request().method() === "GET" &&
        !url.includes("/tree") &&
        !url.includes("/patches") &&
        !url.includes("/snapshots") &&
        !url.includes("/file");
      if (!isList) return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [{ id: repositoryId, repo_id: "org/backend-core", default_branch: "main" }],
            pagination: { total: 1, limit: 100, offset: 0, has_more: false },
          },
        }),
      });
    });
    await page.route("**/api/v1/indexing-jobs*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
    await page.route(`**/api/v1/repositories/${repositoryId}/insights*`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { indexed_files_count: 0, indexed_chunks_count: 0, languages: [] },
        }),
      });
    });
  });

  test.beforeAll(async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticatePage(page, baseURL ?? "http://127.0.0.1:3000");
    await page.goto("/studio", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await context.close();
  });

  test("0. Studio shell loads and session list populates", async ({ page }) => {
    await page.route("**/api/v1/chat/sessions*", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "sess-1",
                session_title: "Auth refactor",
                summary: "Auth refactor",
                metadata: {},
                is_pinned: false,
                is_archived: false,
                repository_id: repositoryId,
              },
            ],
            pagination: { total: 1, limit: 100, offset: 0, has_more: false },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/repositories*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [{ id: repositoryId, repo_id: "org/backend-core", default_branch: "main" }],
          pagination: { total: 1, limit: 100, offset: 0, has_more: false },
        }),
      });
    });

    await gotoStudio(page, `/studio?repository_id=${repositoryId}&panel=explorer`);

    await expect(page.locator('[data-studio-shell="v2"]')).toBeVisible();
    await expect(page.locator('[data-studio-mode="editor"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="editor-workbench"]')).toBeVisible();
  });

  test.fixme("1. Dynamic Tree Explorer lazy loading and patch overlays", async ({ page }) => {
    await page.route(`**/api/v1/repositories/${repositoryId}/tree*`, async (route) => {
      const url = new URL(route.request().url());
      const pathParam = url.searchParams.get("path");

      if (!pathParam) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                { id: "dir-src", path: "src", type: "DIRECTORY", status: "INDEXED" },
                { id: "file-pkg", path: "package.json", type: "FILE", status: "INDEXED" },
              ],
            },
          }),
        });
      }
      if (pathParam === "src") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                { id: "file-main", path: "src/main.py", type: "FILE", status: "MODIFIED" },
                { id: "file-utils", path: "src/utils.py", type: "FILE", status: "ADDED" },
              ],
            },
          }),
        });
      }
      return route.continue();
    });

    await gotoStudio(page, `/studio?repository_id=${repositoryId}&panel=explorer`);
    await waitForRepositoryReady(page);

    await expect(page.getByRole("complementary").getByText("EXPLORER", { exact: true })).toBeVisible();

    const rootFolder = page.locator('[data-testid="tree-folder-toggle-src"]');
    await expect(rootFolder).toBeVisible();
    await expect(page.locator('[data-testid="tree-file-node-package.json"]')).toBeVisible();

    await rootFolder.click();

    await expect(page.locator('[data-testid="tree-file-node-src/main.py"]')).toBeVisible();
    await expect(page.locator('[data-testid="tree-file-node-src/utils.py"]')).toBeVisible();
    await expect(page.locator('[data-testid="tree-node-status-src/main.py"]')).toHaveText("M");
    await expect(page.locator('[data-testid="tree-node-status-src/utils.py"]')).toHaveText("A");
  });

  test.fixme("2. Patch review tab shows validate action for draft patch", async ({ page }) => {
    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}`, async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: patchId,
              status: "DRAFT",
              patch_files: [{ path: "src/main.py", unified_diff: "@@\n-old\n+new" }],
            },
          }),
        });
      }
      return route.continue();
    });

    await gotoStudio(page, `/studio?repository_id=${repositoryId}&patch_id=${patchId}`);
    await waitForRepositoryReady(page);

    await expect(page.getByRole("heading", { name: "Patch Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validate" })).toBeVisible();
  });

  test.fixme("3. Apply patch surfaces error on 409 conflict", async ({ page }) => {
    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}`, async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: patchId,
              status: "APPROVED",
              patch_files: [{ path: "src/main.py", unified_diff: "@@\n-old\n+new" }],
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}/apply`, async (route) => {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            message: "Conflict detected: Repository HEAD has moved. Conflicting files: src/main.py",
            code: "CONFLICT",
          },
        }),
      });
    });

    await gotoStudio(page, `/studio?repository_id=${repositoryId}&patch_id=${patchId}`);
    await waitForRepositoryReady(page);

    await expect(page.getByRole("button", { name: "Apply Patch" })).toBeVisible();
    await page.getByRole("button", { name: "Apply Patch" }).click();
    await expect(page.getByText(/Apply Error|Conflict detected/i)).toBeVisible();
  });

  test.fixme("4. Snapshot timeline list and pinning in snapshots panel", async ({ page }) => {
    await page.route(`**/api/v1/repositories/${repositoryId}/snapshots`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            snapshots: [
              {
                id: "snap-1",
                commit_sha: "fc9b2a1",
                indexed_at: "2026-06-04T12:00:00Z",
                files_count: 10,
                chunks_count: 50,
                is_pinned: false,
                is_release: false,
                index_status: "COMPLETE",
              },
              {
                id: "snap-2",
                commit_sha: "a994efb",
                indexed_at: "2026-06-03T12:00:00Z",
                files_count: 8,
                chunks_count: 42,
                is_pinned: true,
                is_release: true,
                index_status: "COMPLETE",
              },
            ],
            total: 2,
          },
        }),
      });
    });

    let patchPayload: { is_pinned?: boolean } | null = null;
    await page.route(`**/api/v1/repositories/${repositoryId}/snapshots/snap-1`, async (route) => {
      patchPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { updated: true } }),
      });
    });

    await gotoStudio(page, `/studio?repository_id=${repositoryId}&panel=snapshots`);
    await waitForRepositoryReady(page);

    await expect(page.locator('[data-testid="snapshot-timeline-item-snap-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="snapshot-timeline-item-snap-2"]')).toBeVisible();

    await page.locator('[data-testid="snapshot-pin-toggle-snap-1"]').click();
    expect(patchPayload).toEqual({ is_pinned: true });
  });
});
