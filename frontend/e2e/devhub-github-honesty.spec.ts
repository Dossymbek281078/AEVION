import { test, expect } from "@playwright/test";

/**
 * The GitHub tab used to draw the same screen for two opposite situations: a
 * repository with no branches yet, and a repository the token can no longer
 * read. Both showed a repo link and nothing else — the server answered
 * `connected: true` for every failure, and the page dropped the reason anyway.
 *
 * That is not a hypothetical: with the org's GitHub account suspended since
 * 2026-07-27 every token answers 401, so this screen has been claiming a
 * working link for weeks.
 *
 * These specs pin the distinction at the only place it matters — what the
 * person looking at the tab is told.
 */

const PROJECT_ID = "41414141-4242-5353-6464-757575757575";
const REPO = "https://github.com/o/r";
const FILES = [{ id: "f1", path: "index.html", content: "<h1>hi</h1>", language: "html" }];

async function mockGithub(
  page: import("@playwright/test").Page,
  opts: { status?: Record<string, unknown>; branches?: Record<string, unknown>; seen?: string[] },
) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    opts.seen?.push(`${route.request().method()} ${new URL(url).pathname}`);
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/github/status")) return json(opts.status ?? { exists: false });
    if (url.includes("/github/branches")) return json(opts.branches ?? { branches: [], connected: false });
    if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: {
          id: PROJECT_ID, name: "gh", description: "", stack: "static",
          deployUrl: null, repoUrl: REPO, userId: "anonymous", collaborators: [],
        },
        files: FILES,
      });
    }
    if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
    if (url.includes("/deployments")) return json({ deployments: [] });
    return json({ ok: true });
  });
}

async function openGithubTab(page: import("@playwright/test").Page) {
  await page.goto(`/devhub/${PROJECT_ID}`);
  await page.getByRole("tab", { name: "GitHub", exact: true }).click({ timeout: 30_000 });
}

test.describe("DevHub — the GitHub tab says why it cannot read the repo", () => {
  test("a revoked token is named, not drawn as an empty repository", async ({ page }) => {
    await mockGithub(page, {
      status: { exists: false, errorKind: "auth", error: "GitHub token is invalid or revoked — reconnect the repository" },
      branches: { branches: [], connected: false, errorKind: "auth", error: "GitHub token is invalid or revoked — reconnect the repository" },
    });

    await openGithubTab(page);

    const banner = page.getByTestId("github-connection-issue");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/revoked|Репозиторий недоступен/);
  });

  test("a GitHub outage reads as 'could not check', not as a broken link", async ({ page }) => {
    await mockGithub(page, {
      status: { exists: false, errorKind: "unavailable", error: "GitHub is not responding (HTTP 503)" },
      branches: { branches: [], connected: false, errorKind: "unavailable", error: "GitHub is not responding (HTTP 503)" },
    });

    await openGithubTab(page);

    const banner = page.getByTestId("github-connection-issue");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // The wording separates "yours to fix" from "wait and it passes".
    await expect(banner).toContainText(/Не удалось проверить связь/);
  });

  test("'Sync branches' refreshes the list — it does not overwrite the project's files", async ({ page }) => {
    // It used to POST /github/sync, the same endpoint as "Pull from repo",
    // which replaces every file from the repository after a checkpoint. A
    // branch refresh was silently rewriting the user's work.
    const seen: string[] = [];
    await mockGithub(page, {
      seen,
      status: { exists: true, stars: 1, openIssues: 0, lastPush: "2026-08-01T00:00:00Z" },
      branches: { connected: true, repoUrl: REPO, branches: [{ name: "main", sha: "abcdef1" }] },
    });

    await openGithubTab(page);
    await page.getByRole("button", { name: "Sync branches", exact: true }).click({ timeout: 15_000 });

    await expect(page.getByTestId("github-message")).toContainText(/обнов/i, { timeout: 15_000 });
    expect(seen.filter((r) => r.startsWith("POST") && r.endsWith("/github/sync"))).toEqual([]);
  });

  test("a refused refresh is not painted as a success", async ({ page }) => {
    // The banner used to choose its colour by searching the text for "failed"
    // or "error", so any other wording came out green.
    await mockGithub(page, {
      status: { exists: false, errorKind: "auth", error: "GitHub token is invalid or revoked" },
      branches: { branches: [], connected: false, errorKind: "auth", error: "GitHub token is invalid or revoked" },
    });

    await openGithubTab(page);
    await page.getByRole("button", { name: "Sync branches", exact: true }).click({ timeout: 15_000 });

    await expect(page.getByTestId("github-message")).toHaveAttribute("data-tone", "error", { timeout: 15_000 });
  });

  test("a pull that could not read some files does not toast green", async ({ page }) => {
    // The route now marks `degraded` when a blob could not be read, which
    // leaves the project part-new and part-stale — and that mixture is what a
    // later push or deploy builds from. A success-coloured toast over it reads
    // as "all of it arrived".
    //
    // Asserted by colour rather than a test id on purpose: the toast component
    // carries no attribute to hook, and adding one would have invalidated the
    // build this spec runs against. #fef3c7 is the warning background.
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/github/sync")) {
        return json({
          ok: true, branch: "main", updated: ["a.ts"], created: [], unchanged: 0,
          failed: [{ path: "broken.ts", reason: "HTTP 500" }],
          degraded: true, degradedReason: "1 of 2 files could not be read",
          message: "Synced o/r@main: 1 updated, 0 new ⚠ 1 file could not be read and are missing from this sync: broken.ts",
        });
      }
      if (url.includes("/github/status")) return json({ exists: true, stars: 0, openIssues: 0 });
      if (url.includes("/github/branches")) return json({ connected: true, branches: [] });
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: {
            id: PROJECT_ID, name: "gh", description: "", stack: "static",
            deployUrl: null, repoUrl: REPO, userId: "anonymous", collaborators: [],
          },
          files: FILES,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      if (url.includes("/deployments")) return json({ deployments: [] });
      return json({ ok: true });
    });

    await openGithubTab(page);
    await page.getByRole("button", { name: /Pull from repo/ }).click({ timeout: 15_000 });

    const toast = page.getByRole("status").filter({ hasText: "broken.ts" });
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toHaveCSS("background-color", "rgb(254, 243, 199)");
  });

  test("a healthy repo shows its branches and no warning at all", async ({ page }) => {
    await mockGithub(page, {
      status: { exists: true, stars: 3, openIssues: 0, lastPush: "2026-08-01T00:00:00Z" },
      branches: { connected: true, repoUrl: REPO, branches: [{ name: "main", sha: "abcdef1" }] },
    });

    await openGithubTab(page);

    await expect(page.getByText("main", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("github-connection-issue")).toHaveCount(0);
  });
});
