import { test, expect } from "@playwright/test";

// E2E: smoke-проверка backtest UI. Полный run requires ≥2 OHLC candles
// (~minute of market sim ticks) — это тяжело pre-seed'ить, поэтому
// мы только проверяем что secция рендерится со всеми 3 strategy tabs.
test.describe("QTrade · Backtester", () => {
  test("Backtester section renders with 3 strategy tabs and config form", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    // Header
    await expect(page.getByText(/🧪 Backtester/i).first()).toBeVisible({ timeout: 15_000 });

    // Strategy tabs
    await expect(page.getByRole("button", { name: /^DCA$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Grid$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy & Hold/i }).first()).toBeVisible();

    // Switch to Buy & Hold — Total invest input должен появиться
    await page.getByRole("button", { name: /Buy & Hold/i }).first().click();
    await expect(page.getByLabel(/Total invest/i)).toBeVisible();

    // Run-button присутствует (текст «Запустить backtest» — disabled или enabled зависит
    // от candleCount, но кнопка обязана существовать в DOM)
    await expect(page.getByRole("button", { name: /Запустить backtest/i })).toBeVisible();
  });
});
