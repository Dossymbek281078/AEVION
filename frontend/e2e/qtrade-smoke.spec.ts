import { test, expect } from "@playwright/test";

test.describe("QTrade smoke", () => {
  test("/qtrade renders Live Markets + 4 trading pairs", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "QTrade" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Live Markets").first()).toBeVisible();

    // Pair cards render only the short symbol (p.symbol = AEV/BTC/ETH/SOL).
    // Strict-text-equals avoids matching "AEV" prefix inside e.g. "AEVION".
    for (const sym of ["AEV", "BTC", "ETH", "SOL"]) {
      const el = page.getByText(sym, { exact: true }).first();
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }
  });
});
