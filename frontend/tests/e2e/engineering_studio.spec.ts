import { test, expect } from "@playwright/test";

test.describe("Engineering Studio E2E Tests", () => {
  const repositoryId = "repo-123";
  const patchId = "patch-456";

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

    await page.goto(`/studio?repository_id=${repositoryId}&panel=explorer`);

    await expect(page.locator('[data-studio-shell="v2"]')).toBeVisible();
    await expect(page.locator('[data-studio-mode="editor"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="editor-workbench"]')).toBeVisible();
  });

  test("1. Dynamic Tree Explorer lazy loading and patch overlays", async ({ page }) => {
    // Intercept lazy tree api call for root and subfolder
    await page.route(`**/api/v1/repositories/${repositoryId}/tree*`, async (route) => {
      const url = new URL(route.request().url());
      const pathParam = url.searchParams.get("path");
      const patchParam = url.searchParams.get("patch_id");

      if (!pathParam) {
        // Root list
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              { id: "dir-src", path: "src", type: "DIRECTORY", status: "INDEXED" },
              { id: "file-pkg", path: "package.json", type: "FILE", status: "INDEXED" }
            ]
          })
        });
      } else if (pathParam === "src") {
        // Lazy-loaded child nodes with overlay changes
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              { id: "file-main", path: "src/main.py", type: "FILE", status: "MODIFIED" },
              { id: "file-utils", path: "src/utils.py", type: "FILE", status: "ADDED" }
            ]
          })
        });
      }
      return route.continue();
    });

    // Navigate to page
    await page.goto(`/studio?repository_id=${repositoryId}&panel=explorer`);

    // Explorer sidebar header should be visible (sidebar expanded)
    await expect(page.getByText("EXPLORER")).toBeVisible();

    // Verify root items render
    const rootFolder = page.locator('[data-testid="tree-folder-toggle-src"]');
    await expect(rootFolder).toBeVisible();
    await expect(page.locator('[data-testid="tree-file-node-package.json"]')).toBeVisible();

    // Expand folder trigger
    await rootFolder.click();

    // Verify lazy children render
    const modifiedFile = page.locator('[data-testid="tree-file-node-src/main.py"]');
    const addedFile = page.locator('[data-testid="tree-file-node-src/utils.py"]');
    await expect(modifiedFile).toBeVisible();
    await expect(addedFile).toBeVisible();

    // Verify status badges render
    await expect(page.locator('[data-testid="tree-node-status-src/main.py"]')).toHaveText("MODIFIED");
    await expect(page.locator('[data-testid="tree-node-status-src/utils.py"]')).toHaveText("ADDED");
  });

  test("2. ACT Validation Pipeline Stepper & Log Drawer", async ({ page }) => {
    // Mock patch validation call
    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}/validate`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          patch_id: patchId,
          status: "APPROVED",
          validation_logs: "[AST VALIDATION] Checking file src/main.py\n[SUCCESS] AST check passed.\n[TEST EXECUTION] Running test suite\n[SUCCESS] Validation pipeline completed successfully."
        })
      });
    });

    // Mock create patch draft call
    await page.route(`**/api/v1/repositories/${repositoryId}/patches`, async (route) => {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          patch_id: patchId,
          status: "DRAFT",
          created_at: new Date().toISOString()
        })
      });
    });

    await page.goto(`/studio?repository_id=${repositoryId}&view=patch-review&patch_id=${patchId}`);

    // Click validate
    const validateBtn = page.locator('[data-testid="trigger-validation-btn"]');
    await expect(validateBtn).toBeVisible();
    await validateBtn.click();

    // Verify stepper and stages render
    const stepper = page.locator('[data-testid="validation-stepper"]');
    await expect(stepper).toBeVisible();

    // Verify specific steps mark as success
    await expect(page.locator('[data-testid="validation-step-status-ast_validation"]')).toHaveAttribute("data-status", "success");
    await expect(page.locator('[data-testid="validation-step-status-test_execution"]')).toHaveAttribute("data-status", "success");

    // Open logs console and check content
    const toggleLogsBtn = page.locator('[data-testid="toggle-console-logs-btn"]');
    await toggleLogsBtn.click();

    const consoleLogs = page.locator('[data-testid="validation-console-drawer"]');
    await expect(consoleLogs).toBeVisible();
    await expect(consoleLogs).toContainText("[SUCCESS] Validation pipeline completed successfully.");
  });

  test("3. Intercepting Apply Conflicts (409 Status)", async ({ page }) => {
    // Mock create patch draft
    await page.route(`**/api/v1/repositories/${repositoryId}/patches`, async (route) => {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ patch_id: patchId, status: "DRAFT" })
      });
    });

    // Mock 409 Conflict return for apply
    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}/apply`, async (route) => {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Conflict detected: Repository HEAD has moved. Conflicting files: src/main.py",
          expected_sha: "fc9b2a1",
          actual_sha: "a994efb",
          conflicting_files: ["src/main.py"]
        })
      });
    });

    // Mock Delete patch draft call
    let deleteCalled = false;
    await page.route(`**/api/v1/repositories/${repositoryId}/patches/${patchId}`, async (route) => {
      deleteCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true })
      });
    });

    await page.goto(`/studio?repository_id=${repositoryId}&view=patch-review&patch_id=${patchId}`);

    // Click Apply
    const applyBtn = page.locator('[data-testid="apply-to-codebase-btn"]');
    await applyBtn.click();

    // Verify Conflict Modal displays details
    const dialog = page.locator('[data-testid="conflict-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("src/main.py");
    await expect(dialog).toContainText("fc9b2a1");

    // Click Cancel Patch Draft
    const cancelBtn = page.locator('[data-testid="cancel-patch-btn"]');
    await cancelBtn.click();

    // Modal should close and DELETE API should be called
    await expect(dialog).not.toBeVisible();
    expect(deleteCalled).toBe(true);
  });

  test("4. Snapshot Timeline list and Pinning", async ({ page }) => {
    // Mock List Snapshots
    await page.route(`**/api/v1/repositories/${repositoryId}/snapshots`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          snapshots: [
            { id: "snap-1", commit_sha: "fc9b2a1", indexed_at: "2026-06-04T12:00:00Z", files_count: 10, chunks_count: 50, is_pinned: false, is_release: false, index_status: "COMPLETE" },
            { id: "snap-2", commit_sha: "a994efb", indexed_at: "2026-06-03T12:00:00Z", files_count: 8, chunks_count: 42, is_pinned: true, is_release: true, index_status: "COMPLETE" }
          ]
        })
      });
    });

    // Mock Update Snapshot call
    let patchPayload: any = null;
    await page.route(`**/api/v1/repositories/${repositoryId}/snapshots/snap-1`, async (route) => {
      patchPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updated: true })
      });
    });

    await page.goto(`/studio?repository_id=${repositoryId}`);

    // Open Snapshots modal
    const historyBtn = page.locator('[data-testid="snapshot-history-btn"]').first();
    await historyBtn.click();

    // Verify snapshot timeline items render
    const timeline = page.locator('[data-testid="snapshot-timeline-item-snap-1"]');
    await expect(timeline).toBeVisible();
    await expect(page.locator('[data-testid="snapshot-timeline-item-snap-2"]')).toBeVisible();

    // Toggle Pin on snap-1
    const pinToggle = page.locator('[data-testid="snapshot-pin-toggle-snap-1"]');
    await pinToggle.click();

    // Verify payload
    expect(patchPayload).toEqual({ is_pinned: true });
  });

  test("5. Federated search cross-repository retrieval selector", async ({ page }) => {
    // Mock list repositories
    await page.route("**/api/v1/repositories*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { id: "repo-123", repo_id: "backend-core", remote_url: "github.com/backend" },
            { id: "repo-789", repo_id: "frontend-ui", remote_url: "github.com/frontend" }
          ],
          pagination: { total: 2, limit: 100, offset: 0, has_more: false }
        })
      });
    });

    // Mock project retrieval call
    let retrievePayload: any = null;
    await page.route("**/api/v1/projects/default-project/retrieve", async (route) => {
      retrievePayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { id: "chunk-1", path: "src/auth.ts", content: "export function login() {}", score: 0.95, repository_id: "repo-123" }
          ]
        })
      });
    });

    await page.goto(`/studio?repository_id=repo-123&ai=open`);

    // Click Multi-Repository select popover
    const selectTrigger = page.locator('[data-testid="multi-repo-trigger-btn"]');
    await expect(selectTrigger).toBeVisible();
    await selectTrigger.click();

    // Toggle selection of both repositories
    const backendCheck = page.locator('[data-testid="repo-combobox-item-repo-123"]');
    const frontendCheck = page.locator('[data-testid="repo-combobox-item-repo-789"]');
    await backendCheck.click();
    await frontendCheck.click();

    // Close select trigger
    await page.keyboard.press("Escape");

    // Enter query and click send
    const textarea = page.locator("textarea");
    await textarea.fill("explain the login flow");
    const sendBtn = page.locator('button:has-text("Send")'); // fallback or locator
    
    // Trigger message send
    await page.keyboard.press("Control+Enter");

    // Assert that the project retrieve api was called with the checked repository IDs
    expect(retrievePayload).toEqual(expect.objectContaining({
      query: "explain the login flow",
      repository_ids: ["repo-123", "repo-789"]
    }));
  });
});
