import { test, expect } from "@playwright/test";

const GRID_BOTS_KEY = "aevion_qtrade_grid_bots_v1";

// E2E: создаёт grid bot через UI form, ассертит persistence + shape.
// Стратегия: жмём ±5% prefill (берёт текущую цену), заполняем levels=4
// и $20/level, потом «Запустить grid».
test.describe("QTrade · Grid bot lifecycle", () => {
  test("create AEV/USD grid bot with ±5% prefill and persist it", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/🎯 Grid Bot/i).first()).toBeVisible({ timeout: 15_000 });

    // Default gridPair = BTC/USD; switch to AEV/USD before prefill so ±5% pulls the
    // AEV/USD price into Low/High and creates AEV/USD-bound bot.
    const gridPanel = page.getByText(/🎯 Grid Bot/i).locator("..").locator("..");
    await gridPanel.locator("select").first().selectOption("AEV/USD");

    // ±5% prefill — fills Low/High inputs from current AEV/USD price
    await page.getByRole("button", { name: /^±5%$/ }).click();

    // Set levels=4, $/level=20 (overwrite defaults)
    const levelsInput = page.getByLabel(/Levels \(2-30\)/);
    await levelsInput.fill("4");
    const perLevelInput = page.getByLabel(/\$ per level/);
    await perLevelInput.fill("20");

    await page.getByRole("button", { name: /▶ Запустить grid/i }).click();

    await expect.poll(async () => {
      return await page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return 0;
        try { return (JSON.parse(raw) as unknown[]).length } catch { return 0 }
      }, GRID_BOTS_KEY);
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    const grid = await page.evaluate((k) => {
      const raw = window.localStorage.getItem(k);
      if (!raw) return null;
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
      } catch { return null }
    }, GRID_BOTS_KEY);

    expect(grid).not.toBeNull();
    expect(grid.pair).toBe("AEV/USD");
    expect(grid.status).toBe("active");
    expect(Array.isArray(grid.levels)).toBe(true);
    expect(grid.levels.length).toBe(4);
    expect(grid.lowPrice).toBeGreaterThan(0);
    expect(grid.highPrice).toBeGreaterThan(grid.lowPrice);
  });
});
