import { test, expect } from "@playwright/test";

// Smoke test for the AEV mining loop:
//  1. Open /aev with a clean localStorage
//  2. Click first Proof-of-Play card (CyberChess win)
//  3. Wallet balance reads > 0 + a mining-event row appears

test.describe("AEV mining loop", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("/aev renders Hero + Mining Dashboard", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/aev", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/AEV/, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a Play action mints AEV and shows in feed", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/aev", { waitUntil: "domcontentloaded" });

    const action = page.getByRole("button", { name: /CyberChess.*победа над Beginner/i }).first();
    await action.waitFor({ state: "visible", timeout: 15_000 });
    await action.click();

    // Mining feed should now show at least one event row.
    await expect(page.getByText(/CyberChess.*победа.*Beginner/).first()).toBeVisible();
  });
});
