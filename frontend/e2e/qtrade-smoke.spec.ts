import { test, expect } from "@playwright/test";

test.describe("QTrade smoke", () => {
  test("/qtrade renders Live Markets + 4 trading pairs", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "QTrade" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Live Markets")).toBeVisible();

    for (const sym of ["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"]) {
      await expect(page.getByText(sym).first()).toBeVisible();
    }
  });
});
