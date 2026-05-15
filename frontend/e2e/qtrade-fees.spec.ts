import { test, expect } from "@playwright/test";

const FEES_KEY = "aevion_qtrade_fees_v1";
const CLOSED_KEY = "aevion_qtrade_closed_v1";

// Pre-seed fees enabled with $100 daily-loss cap and a closed position
// сегодня с realized P&L = -75 → 75% usage. Risk widget должен показаться:
// progress bar [role=progressbar][aria-valuenow=75], 🛡 pill в header.
test.describe("QTrade · fees + risk widget", () => {
  test("risk pill + progress bar render when fees enabled & today's loss accumulated", async ({ page }) => {
    await page.addInitScript(({ feesKey, closedKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(feesKey, JSON.stringify({
          enabled: true,
          makerBps: 4,
          takerBps: 10,
          slippageBps: 5,
          dailyLossLimitUsd: 100,
        }));
        const now = Date.now();
        window.localStorage.setItem(closedKey, JSON.stringify([{
          id: "seed",
          pair: "BTC/USD",
          side: "long",
          qty: 0.5,
          entryPrice: 100,
          entryTs: now - 3_600_000,
          exitPrice: 50,
          exitTs: now,
          realizedPnl: -75,
          realizedPct: -50,
        }]));
      } catch {/* test setup best-effort */}
    }, { feesKey: FEES_KEY, closedKey: CLOSED_KEY });

    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    // FeesPanel header collapsed by default; risk pill carries shield emoji
    const feesSection = page.getByLabel("Trading fees and slippage settings");
    await expect(feesSection).toBeVisible({ timeout: 15_000 });

    const riskPill = feesSection.getByText(/🛡/);
    await expect(riskPill).toBeVisible();

    // Progress bar a11y: usage = 75 (= -75 / -100 × 100)
    const progress = feesSection.getByRole("progressbar");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", "75");
    await expect(progress).toHaveAttribute("aria-valuemax", "100");
  });

  test("collapse expands inputs when clicked", async ({ page }) => {
    await page.addInitScript(({ feesKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(feesKey, JSON.stringify({
          enabled: true, makerBps: 4, takerBps: 10, slippageBps: 5, dailyLossLimitUsd: 0,
        }));
      } catch {/* setup */}
    }, { feesKey: FEES_KEY });

    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    const feesSection = page.getByLabel("Trading fees and slippage settings");
    await expect(feesSection).toBeVisible({ timeout: 15_000 });

    // Expand by clicking the header button (role=button, aria-expanded=false)
    const header = feesSection.getByRole("button", { expanded: false });
    await header.click();

    // After expand: 4 inputs become visible
    await expect(feesSection.getByLabel("Maker bps")).toBeVisible();
    await expect(feesSection.getByLabel("Taker bps")).toBeVisible();
    await expect(feesSection.getByLabel("Slippage bps")).toBeVisible();
    await expect(feesSection.getByLabel("Daily-loss USD")).toBeVisible();
  });
});
