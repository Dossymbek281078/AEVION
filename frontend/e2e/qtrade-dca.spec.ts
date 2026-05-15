import { test, expect } from "@playwright/test";

test.describe("QTrade · DCA Auto-Trader", () => {
  test("DCA section renders with header + tagline", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/DCA Auto-Trader/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/покупает фиксированную сумму USD каждые N секунд/i)).toBeVisible();
  });
});
