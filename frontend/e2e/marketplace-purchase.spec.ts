import { test, expect } from "@playwright/test";

const WALLET_KEY = "aevion_aev_wallet_v1";
const OWNED_KEY = "aevion_aev_marketplace_owned_v1";

// E2E: Pre-seed wallet with 50 AEV, navigate to /aev, switch Marketplace
// filter to Themes, click "🛒 Купить" on Theme: Aurora (price 10),
// assert owned[] persists "theme_aurora" and balance was debited.
test.describe("AEV Marketplace · purchase", () => {
  test("buy Theme: Aurora debits 10 AEV and adds to owned list", async ({ page }) => {
    await page.addInitScript(({ walletKey, ownedKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(walletKey, JSON.stringify({
          v: 1,
          balance: 50,
          lifetimeMined: 50,
          lifetimeSpent: 0,
          globalSupplyMined: 50,
          modes: { play: true, compute: false, stewardship: true },
          stake: [],
          recent: [],
          startTs: Date.now(),
          dividendsClaimed: 0,
        }));
        window.localStorage.setItem(ownedKey, JSON.stringify([]));
      } catch {/* test setup best-effort */}
    }, { walletKey: WALLET_KEY, ownedKey: OWNED_KEY });

    await page.goto("/aev", { waitUntil: "domcontentloaded" });

    // Marketplace section header
    await expect(page.getByRole("heading", { name: /AEV Marketplace/i })).toBeVisible({ timeout: 15_000 });

    // Switch to Themes filter — narrows items to 3 cards (theme_aurora is first
    // in MARKETPLACE array order, so .first() on 🛒 Купить targets it).
    await page.getByRole("button", { name: /🎨 Темы/i }).click();

    const buyBtn = page.getByRole("button", { name: /🛒 Купить/i }).first();
    await buyBtn.waitFor({ state: "visible", timeout: 10_000 });
    await buyBtn.click();

    // Assert owned[] persists "theme_aurora"
    await expect.poll(async () => {
      const owned = await page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return [] as string[];
        try { return JSON.parse(raw) as string[] } catch { return [] }
      }, OWNED_KEY);
      return owned.includes("theme_aurora");
    }, { timeout: 5_000 }).toBe(true);

    // Wallet balance debited by 10 (50 → 40). Background auto-mining (network
    // invites, stewardship dividends, streak bonuses) may add fractional AEV
    // during the test window — use ±1 AEV tolerance to capture the -10 debit
    // without flaking on tick-timing.
    const balance = await page.evaluate((k) => {
      const raw = window.localStorage.getItem(k);
      if (!raw) return 0;
      try { return (JSON.parse(raw).balance ?? 0) as number } catch { return 0 }
    }, WALLET_KEY);
    expect(balance).toBeGreaterThanOrEqual(39);
    expect(balance).toBeLessThanOrEqual(41);
  });
});
