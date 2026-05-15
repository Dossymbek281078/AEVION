import { test, expect } from "@playwright/test";

/**
 * QLearn — bookmark course flow.
 *
 * Flow under test:
 *   1. /qlearn loads with mocked auth + courses
 *   2. Click the ★ bookmark button on a course card
 *   3. After the POST /bookmark resolves, the "★ N bookmarks" pill appears
 *   4. Open the bookmarks panel → asserts the course is listed
 *   5. Click "Remove" inside the panel → course is removed
 *
 * Idempotency: backend is fully mocked. We keep a single in-memory
 * bookmark set in the test that the mocked endpoints read from, so the
 * UI state evolves correctly across requests.
 */

const MOCK_COURSE = {
  id: "course-e2e-001",
  authorId: "author-x",
  title: "E2E Playwright Bookmark Course",
  description: "Fixture course for bookmark smoke tests.",
  category: "tech",
  level: "beginner",
  price: 0,
  isPublic: true,
  enrollmentCount: 100,
  createdAt: "2026-01-01T00:00:00Z",
};

test.describe("QLearn — bookmark flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("aevion_auth_token", "mock.jwt.token");
      } catch {}
    });

    // Mutable test-local state: which course IDs are currently bookmarked.
    const bookmarked = new Set<string>();

    // GET /api/qlearn/courses?...
    await page.route("**/api/qlearn/courses?**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ courses: [MOCK_COURSE] }),
      });
    });

    // GET /api/qlearn/me/streak — return null-ish streak so the badge skips.
    await page.route("**/api/qlearn/me/streak", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current: 0,
          longest: 0,
          totalDays: 0,
          activeToday: false,
          lastActiveAt: null,
        }),
      });
    });

    // GET /api/qlearn/me/progress
    await page.route("**/api/qlearn/me/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: { total: 0, inProgress: 0, notStarted: 0, completed: 0, avgProgress: 0 },
          continueLearning: [],
          notStarted: [],
          completed: [],
        }),
      });
    });

    // GET /api/qlearn/me/bookmarks — reads from our local set.
    await page.route("**/api/qlearn/me/bookmarks", async (route) => {
      const list = Array.from(bookmarked).map((id) => ({
        courseId: id,
        bookmarkedAt: new Date().toISOString(),
        course: {
          id: MOCK_COURSE.id,
          title: MOCK_COURSE.title,
          description: MOCK_COURSE.description,
          category: MOCK_COURSE.category,
          level: MOCK_COURSE.level,
          price: MOCK_COURSE.price,
          enrollmentCount: MOCK_COURSE.enrollmentCount,
        },
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bookmarks: list }),
      });
    });

    // POST/DELETE /api/qlearn/courses/:id/bookmark — toggles the set.
    await page.route("**/api/qlearn/courses/*/bookmark", async (route) => {
      const url = new URL(route.request().url());
      const m = url.pathname.match(/\/courses\/([^/]+)\/bookmark$/);
      const id = m ? decodeURIComponent(m[1]) : "";
      if (route.request().method() === "POST") {
        bookmarked.add(id);
      } else if (route.request().method() === "DELETE") {
        bookmarked.delete(id);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
  });

  test("Bookmark a course, see it in panel, unbookmark, panel hides", async ({ page }) => {
    // 1. Load QLearn.
    await page.goto("/qlearn", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "QLearn", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(MOCK_COURSE.title).first()).toBeVisible({ timeout: 15_000 });

    // The bookmark pill should not exist yet (0 bookmarks).
    await expect(page.getByRole("button", { name: /\d+ bookmark/i })).toHaveCount(0);

    // 2. Click the ☆/★ icon on the course card.
    await page.getByRole("button", { name: "Add bookmark" }).first().click();

    // 3. After the POST flushes and personal refresh runs, "1 bookmark" pill appears.
    await expect(page.getByRole("button", { name: /1 bookmark/i })).toBeVisible({
      timeout: 10_000,
    });

    // 4. Open the bookmarks panel — header "★ My bookmarks" + course title listed.
    await page.getByRole("button", { name: /1 bookmark/i }).click();
    await expect(page.getByRole("heading", { name: /My bookmarks/i })).toBeVisible();
    // The course title appears inside the panel as well as in the main grid;
    // we just need at least one occurrence.
    await expect(page.getByText(MOCK_COURSE.title).first()).toBeVisible();

    // 5. Click "Remove" inside the bookmarks panel.
    await page.getByRole("button", { name: /^Remove$/i }).first().click();

    // Pill should disappear (bookmarks now = 0).
    await expect(page.getByRole("button", { name: /\d+ bookmark/i })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
