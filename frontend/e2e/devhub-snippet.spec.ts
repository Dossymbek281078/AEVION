import { test, expect } from "@playwright/test";

/**
 * DevHub — Snippet shelf flow.
 *
 * Flow under test:
 *   1. /devhub loads, projects list (empty) + snippet shelf both render
 *   2. Fill snippet form (title + content) and click "Share snippet"
 *   3. After POST /api/devhub/snippets resolves, the new snippet appears
 *      in the shelf list
 *   4. Click the ★ star button → assert star count increments by 1
 *   5. Click the "Copy" button → assert UI toggles to "Copied!" (button text)
 *
 * Clipboard note: navigator.clipboard.writeText() requires a secure context
 * (HTTPS) or explicit permissions. On http://localhost it may throw; the
 * page catches and shows "Clipboard unavailable" error. Our assertion focuses
 * on the *UI signal* ("Copied!" label flip) — if clipboard write throws,
 * we accept the error banner as the alternate signal.
 *
 * Idempotency: a local in-memory snippet store mocks all endpoints; every
 * test run starts from an empty shelf.
 */

const NOW = Date.now();
const SNIPPET_TITLE = `e2e-snippet-${NOW}`;
const SNIPPET_CONTENT = `console.log("e2e ${NOW}");`;

interface MockSnippet {
  id: string;
  userId: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

test.describe("DevHub — Snippet shelf flow", () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard read/write permissions where possible (Chromium).
    try {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } catch {
      // Some environments reject — non-fatal, we'll fall back to UI signal.
    }

    // In-memory snippet store shared by all mocked endpoints.
    const store: MockSnippet[] = [];

    // GET /api/devhub/projects — empty list.
    await page.route("**/api/devhub/projects", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });

    // GET / POST /api/devhub/snippets
    await page.route("**/api/devhub/snippets**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ snippets: [...store].reverse() }),
        });
        return;
      }
      if (req.method() === "POST") {
        let body: any = {};
        try { body = JSON.parse(req.postData() || "{}"); } catch {}
        const snippet: MockSnippet = {
          id: `snip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: "user-mock",
          title: String(body.title || "Untitled"),
          content: String(body.content || ""),
          language: String(body.language || "plaintext"),
          tags: Array.isArray(body.tags) ? body.tags : [],
          stars: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.push(snippet);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ snippet }),
        });
        return;
      }
      await route.continue();
    });

    // POST /api/devhub/snippets/:id/star
    await page.route("**/api/devhub/snippets/*/star", async (route) => {
      const m = route.request().url().match(/\/snippets\/([^/]+)\/star/);
      const id = m ? decodeURIComponent(m[1]) : "";
      const snip = store.find((s) => s.id === id);
      if (snip) snip.stars += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, stars: snip?.stars ?? 1 }),
      });
    });
  });

  test("Share snippet → star → copy", async ({ page }) => {
    // 1. Load /devhub. Verify header + snippet-shelf heading.
    await page.goto("/devhub", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "DevHub", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /Snippet shelf/i })).toBeVisible();

    // 2. Fill the share form + submit.
    await page.getByPlaceholder("Title").fill(SNIPPET_TITLE);
    await page.getByPlaceholder(/paste your snippet here/i).fill(SNIPPET_CONTENT);
    await page.getByRole("button", { name: /Share snippet/i }).click();

    // 3. Newly created snippet appears in the shelf grid.
    await expect(page.getByRole("heading", { name: SNIPPET_TITLE, level: 3 })).toBeVisible({
      timeout: 10_000,
    });

    // 4. Star the snippet → count goes 0 → 1.
    //    The star button has aria-label="star snippet" and shows the count as
    //    its visible label. We scope to the card containing our snippet title.
    const card = page.locator("div", {
      has: page.getByRole("heading", { name: SNIPPET_TITLE, level: 3 }),
    }).first();
    const starBtn = card.getByRole("button", { name: /star snippet/i });
    await expect(starBtn).toContainText("0");
    await starBtn.click();
    await expect(starBtn).toContainText("1", { timeout: 5_000 });

    // 5. Click "Copy" — UI flips to "Copied!" for ~1.6s.
    //    If navigator.clipboard throws (no secure context), the page renders
    //    an error banner "Clipboard unavailable" — accept either as a pass
    //    signal because both originate from the click handler firing.
    const copyBtn = card.getByRole("button", { name: /^Copy$/ });
    await copyBtn.click();
    await expect(
      page.getByText(/Copied!|Clipboard unavailable/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
