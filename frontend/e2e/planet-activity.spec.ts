import { test, expect } from "@playwright/test";

/**
 * Planet Activity Feed — /planet/activity
 *
 * Flow under test:
 *   1. /planet/activity loads, page heading + feed mount
 *   2. With at least 4 mocked items (one of each kind), the activity items
 *      render with a kind label + descriptive text
 *   3. Click the "Certified" tab → feed re-fetches with ?kinds=certified
 *      → only certified items remain visible
 *   4. Certified rows contain an artifact-detail link to /planet/artifact/[ref]
 *
 * Idempotency: backend endpoint is fully mocked and filters server-side
 * by the `kinds` query param.
 */

const NOW = new Date().toISOString();

const ALL_ITEMS = [
  {
    kind: "submitted",
    id: "sub-1",
    at: NOW,
    ownerId: "user-aaaa-bbbb",
    ref: "product-key-1",
    title: "Submission alpha",
  },
  {
    kind: "certified",
    id: "cert-1",
    at: NOW,
    ownerId: "user-cccc-dddd",
    ref: "artifact-version-cert-1",
    title: null,
  },
  {
    kind: "certified",
    id: "cert-2",
    at: NOW,
    ownerId: "user-eeee-ffff",
    ref: "artifact-version-cert-2",
    title: null,
  },
  {
    kind: "revoked",
    id: "rev-1",
    at: NOW,
    ownerId: "user-gggg-hhhh",
    ref: "artifact-version-rev-1",
    title: "policy violation",
  },
  {
    kind: "voted",
    id: "vote-1",
    at: NOW,
    ownerId: "user-iiii-jjjj",
    ref: "artifact-version-vote-1",
    title: "quality",
  },
];

test.describe("Planet — /planet/activity feed", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the activity endpoint with server-side filter by `kinds`.
    await page.route("**/api/planet/activity*", async (route) => {
      const url = new URL(route.request().url());
      const kindsParam = url.searchParams.get("kinds");
      const wanted = kindsParam ? kindsParam.split(",") : null;
      const items = wanted ? ALL_ITEMS.filter((i) => wanted.includes(i.kind)) : ALL_ITEMS;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          count: items.length,
          kinds: ["submitted", "certified", "revoked", "voted"],
        }),
      });
    });
  });

  test("Renders feed, switches to Certified tab, shows artifact link", async ({ page }) => {
    // 1. Load page.
    await page.goto("/planet/activity", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Planet activity feed/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // 2. Multiple items render — at least Submitted + Certified + Revoked + Voted
    //    label chips. The KIND_META labels are uppercase ("SUBMITTED" etc.).
    for (const label of ["SUBMITTED", "CERTIFIED", "REVOKED", "VOTED"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // 3. Click the "Certified" tab in the filter row.
    //    The tab button text is "Certified" (matches against the visible label).
    await page.getByRole("button", { name: /^✅?\s*Certified$/i }).click();

    // After re-fetch, "SUBMITTED" / "REVOKED" / "VOTED" labels disappear
    // (only certified items render).
    await expect(page.getByText("SUBMITTED", { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByText("REVOKED", { exact: true })).toHaveCount(0);
    await expect(page.getByText("VOTED", { exact: true })).toHaveCount(0);

    // Both certified items remain.
    await expect(page.getByText("CERTIFIED", { exact: true })).toHaveCount(2);

    // 4. The certified rows contain a link to /planet/artifact/[ref].
    //    `buildArtifactLink` produces `/planet/artifact/${encodeURIComponent(ref)}`.
    const artifactLink = page
      .getByRole("link", { name: /Certificate issued for artifact/i })
      .first();
    await expect(artifactLink).toBeVisible();
    await expect(artifactLink).toHaveAttribute(
      "href",
      /\/planet\/artifact\/artifact-version-cert-[12]/,
    );

    // 5. Footer reference to transparency stats is rendered.
    await expect(
      page.getByRole("link", { name: /aggregate transparency stats/i }),
    ).toBeVisible();
  });
});
