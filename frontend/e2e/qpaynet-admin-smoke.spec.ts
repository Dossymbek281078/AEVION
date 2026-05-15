import { test, expect } from "@playwright/test";

// Smoke E2E for QPayNet admin UI. Doesn't authenticate — just verifies that
// every page renders without runtime errors and shows the expected structure
// for an unauthenticated visitor (the "Войдите как админ" prompt). This
// catches build-time regressions, broken imports, and runtime crashes
// before any backend round-trip.
//
// To run against an authenticated session, set ADMIN_JWT in env: the suite
// will inject `aevion_token` into localStorage and drive the dashboard.

const ADMIN_JWT = process.env.ADMIN_JWT;

const ADMIN_PAGES = [
  { path: "/qpaynet/admin", titleHint: "Operations dashboard" },
  { path: "/qpaynet/admin/reconcile", titleHint: "Reconciliation" },
  { path: "/qpaynet/admin/refund", titleHint: "Refund" },
  { path: "/qpaynet/admin/freeze", titleHint: "Freeze" },
  { path: "/qpaynet/admin/webhook-deliveries", titleHint: "Webhook deliveries" },
  { path: "/qpaynet/admin/audit", titleHint: "Audit log" },
  { path: "/qpaynet/admin/payouts", titleHint: "Payouts" },
  { path: "/qpaynet/admin/kyc", titleHint: "KYC" },
];

test.describe("QPayNet admin pages", () => {
  for (const p of ADMIN_PAGES) {
    test(`anon ${p.path} renders without runtime errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", err => consoleErrors.push(err.message));
      page.on("console", msg => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      // Anon visitor sees the "log in" prompt or the auth-denied screen
      await expect(page.locator("body")).toContainText(/Войдите как админ|admin/i, {
        timeout: 5_000,
      });

      // Filter out unrelated noise (Next.js HMR / 3rd-party / network failures
      // when no backend is running). We only fail on errors that look like
      // application bugs.
      const real = consoleErrors.filter(e =>
        !/HMR|hot-update|favicon|Failed to fetch|net::ERR_/i.test(e),
      );
      expect(real, `pageerrors on ${p.path}: ${real.join("\n")}`).toEqual([]);
    });
  }

  test.skip(!ADMIN_JWT, "ADMIN_JWT not set — skipping authed flows");

  test("authed admin index loads tiles", async ({ page, context }) => {
    if (!ADMIN_JWT) test.skip();
    await context.addInitScript(token => {
      window.localStorage.setItem("aevion_token", token);
    }, ADMIN_JWT);
    await page.goto("/qpaynet/admin");
    await expect(page.getByText("Operations dashboard")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Reconciliation")).toBeVisible();
    await expect(page.getByText("Refund")).toBeVisible();
    await expect(page.getByText("Freeze / Unfreeze")).toBeVisible();
    await expect(page.getByText("Webhook deliveries")).toBeVisible();
    await expect(page.getByText("Audit log")).toBeVisible();
  });
});
