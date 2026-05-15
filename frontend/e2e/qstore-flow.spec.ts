import { test, expect } from "@playwright/test";

/**
 * QStore — end-to-end purchase/review flow.
 *
 * Flow under test:
 *   1. /qstore loads marketplace + lists products (or empty state)
 *   2. Clicking a product card navigates to /qstore/[id] detail page
 *   3. Detail page shows reviews section + review form
 *   4. With a mocked auth token in localStorage, submitting a review hits
 *      POST /api/qstore/products/:id/review — we intercept and assert
 *      the request was sent
 *   5. Breadcrumb "← QStore" returns to the list
 *
 * Idempotency: we mock all network calls so the test does not depend on
 * a running backend or seeded data. The test can be run repeatedly without
 * any cleanup.
 */

const MOCK_PRODUCT = {
  id: "prod-e2e-001",
  sellerId: "seller-abc",
  title: "E2E Test Template",
  description: "A digital product fixture used by Playwright smoke tests.",
  category: "template",
  price: 0,
  currency: "usd",
  previewUrl: "",
  tags: ["test", "fixture"],
  salesCount: 12,
  avgRating: 4.5,
  reviewCount: 3,
  isPublic: true,
  createdAt: "2026-01-01T00:00:00Z",
};

test.describe("QStore — purchase + review flow", () => {
  test.beforeEach(async ({ page }) => {
    // Seed an auth token so review submission is allowed.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("aevion_auth_token", "mock.jwt.token");
      } catch {}
    });

    // Mock the product list endpoint (called on /qstore).
    await page.route("**/api/qstore/products?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [MOCK_PRODUCT] }),
      });
    });

    // Mock featured endpoint (called on /qstore page mount).
    await page.route("**/api/qstore/featured**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          popular: [MOCK_PRODUCT],
          newest: [MOCK_PRODUCT],
          trending: [],
          topRated: [],
        }),
      });
    });

    // Mock single product detail endpoint.
    await page.route(`**/api/qstore/products/${MOCK_PRODUCT.id}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ product: MOCK_PRODUCT }),
      });
    });

    // Mock reviews list endpoint.
    await page.route(`**/api/qstore/products/${MOCK_PRODUCT.id}/reviews`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reviews: [] }),
      });
    });
  });

  test("Open /qstore, click product, submit review, return to list", async ({ page }) => {
    // 1. List page renders the product card.
    await page.goto("/qstore", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "QStore", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(MOCK_PRODUCT.title).first()).toBeVisible({ timeout: 15_000 });

    // 2. Click the product card → navigate to detail page.
    await page.getByText(MOCK_PRODUCT.title).first().click();
    await expect(page).toHaveURL(new RegExp(`/qstore/${MOCK_PRODUCT.id}$`), {
      timeout: 15_000,
    });

    // 3. Detail page surface — title + reviews block.
    await expect(page.getByRole("heading", { name: MOCK_PRODUCT.title })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Leave a review/i)).toBeVisible();

    // 4. Intercept the review POST to assert the form fires it.
    let reviewPosted = false;
    let postedRating: number | null = null;
    await page.route(`**/api/qstore/products/${MOCK_PRODUCT.id}/review`, async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        reviewPosted = true;
        try {
          const body = JSON.parse(req.postData() || "{}");
          postedRating = typeof body.rating === "number" ? body.rating : null;
        } catch {}
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Click 4-star rating button + fill comment + submit.
    await page.getByRole("button", { name: "4 stars" }).click();
    await page.getByPlaceholder(/Share your experience/i).fill(
      `e2e review @ ${Date.now()}`,
    );
    await page.getByRole("button", { name: /Post review/i }).click();

    // Wait briefly for the request to flush.
    await expect.poll(() => reviewPosted, { timeout: 5_000 }).toBe(true);
    expect(postedRating).toBe(4);

    // 5. Breadcrumb returns to /qstore.
    await page.getByRole("link", { name: /← QStore/ }).click();
    await expect(page).toHaveURL(/\/qstore\/?$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "QStore", level: 1 })).toBeVisible();
  });
});
