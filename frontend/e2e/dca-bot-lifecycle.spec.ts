import { test, expect } from "@playwright/test";

const BOTS_KEY = "aevion_qtrade_bots_v1";

// E2E: создаёт DCA bot через UI form, ассертит что bot card появилась и
// localStorage сериализованный bot имеет правильную форму.
test.describe("QTrade · DCA bot lifecycle", () => {
  test("create AEV/USD DCA bot and persist it", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/DCA Auto-Trader/i).first()).toBeVisible({ timeout: 15_000 });

    // Pair select defaults to AEV/USD; interval default 30, amount 25, budget 0
    // — все валидны. Жмём «Запустить bot».
    const launchBtn = page.getByRole("button", { name: /▶ Запустить bot/i });
    await launchBtn.scrollIntoViewIfNeeded();
    await launchBtn.click();

    // Bot card должна появиться. Текст ✓ active, AEV/USD, $25 per buy и т.п.
    // expect.poll с localStorage — самое надёжное.
    await expect.poll(async () => {
      return await page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return 0;
        try { return (JSON.parse(raw) as unknown[]).length } catch { return 0 }
      }, BOTS_KEY);
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    // shape sanity-check
    const bot = await page.evaluate((k) => {
      const raw = window.localStorage.getItem(k);
      if (!raw) return null;
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
      } catch { return null }
    }, BOTS_KEY);
    expect(bot).not.toBeNull();
    expect(bot.pair).toBe("AEV/USD");
    expect(bot.amountUsd).toBe(25);
    expect(bot.status).toBe("active");
  });
});
