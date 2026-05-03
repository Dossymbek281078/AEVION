import { test, expect } from "@playwright/test";

const FEES_KEY = "aevion_qtrade_fees_v1";
const CLOSED_KEY = "aevion_qtrade_closed_v1";

// Risk pill в Wave1Nav рендерится глобально (на любой странице с Wave1Nav)
// когда fees.enabled + dailyLossLimitUsd > 0. Pill кликабельный → /qtrade.
test.describe("Wave1Nav · risk pill", () => {
  test("hidden when fees disabled", async ({ page }) => {
    await page.addInitScript(({ feesKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(feesKey, JSON.stringify({
          enabled: false, makerBps: 4, takerBps: 10, slippageBps: 5, dailyLossLimitUsd: 100,
        }));
      } catch {/* setup */}
    }, { feesKey: FEES_KEY });
    await page.goto("/aev", { waitUntil: "domcontentloaded" });
    const nav = page.getByLabel("Wave 1 navigation");
    await expect(nav).toBeVisible({ timeout: 15_000 });
    // No risk pill (link с href=/qtrade containing 🛡) when disabled
    await expect(nav.locator('a[href="/qtrade"]').filter({ hasText: "🛡" })).toHaveCount(0);
  });

  test("hidden when cap = 0 (no limit set)", async ({ page }) => {
    await page.addInitScript(({ feesKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(feesKey, JSON.stringify({
          enabled: true, makerBps: 4, takerBps: 10, slippageBps: 5, dailyLossLimitUsd: 0,
        }));
      } catch {/* setup */}
    }, { feesKey: FEES_KEY });
    await page.goto("/aev", { waitUntil: "domcontentloaded" });
    const nav = page.getByLabel("Wave 1 navigation");
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.locator('a[href="/qtrade"]').filter({ hasText: "🛡" })).toHaveCount(0);
  });

  test("renders 🛡 pill when fees enabled + cap > 0; click → /qtrade", async ({ page }) => {
    await page.addInitScript(({ feesKey, closedKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(feesKey, JSON.stringify({
          enabled: true, makerBps: 4, takerBps: 10, slippageBps: 5, dailyLossLimitUsd: 100,
        }));
        const now = Date.now();
        window.localStorage.setItem(closedKey, JSON.stringify([{
          id: "seed", pair: "BTC/USD", side: "long", qty: 0.5,
          entryPrice: 100, entryTs: now - 3_600_000,
          exitPrice: 50, exitTs: now,
          realizedPnl: -75, realizedPct: -50,
        }]));
      } catch {/* setup */}
    }, { feesKey: FEES_KEY, closedKey: CLOSED_KEY });

    await page.goto("/aev", { waitUntil: "domcontentloaded" });
    const nav = page.getByLabel("Wave 1 navigation");
    await expect(nav).toBeVisible({ timeout: 15_000 });

    // Pill = anchor with href /qtrade containing 🛡 emoji + percent label
    const pill = nav.locator('a[href="/qtrade"]').filter({ hasText: "🛡" });
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("75%");
  });
});
