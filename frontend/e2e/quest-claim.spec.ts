import { test, expect } from "@playwright/test";

const WALLET_KEY = "aevion_aev_wallet_v1";
const CLAIMED_KEY = "aevion_aev_quests_claimed_v1";

// E2E: Pre-seed wallet with lifetimeMined 0.05 (≥ first_mint target 0.01).
// Visit /aev, click the first_mint Claim button, assert balance increased
// and the quest id is persisted in claimed list.
test.describe("AEV Quests · claim", () => {
  test("first_mint quest becomes claimable and credits +0.50 AEV", async ({ page }) => {
    await page.addInitScript(({ walletKey, claimedKey }) => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem(walletKey, JSON.stringify({
          v: 1,
          balance: 0.05,
          lifetimeMined: 0.05,
          lifetimeSpent: 0,
          globalSupplyMined: 0.05,
          modes: { play: true, compute: false, stewardship: true },
          stake: [],
          recent: [],
          startTs: Date.now(),
          dividendsClaimed: 0,
        }));
        window.localStorage.setItem(claimedKey, JSON.stringify([]));
      } catch {/* test setup best-effort */}
    }, { walletKey: WALLET_KEY, claimedKey: CLAIMED_KEY });

    await page.goto("/aev", { waitUntil: "domcontentloaded" });

    // Quest panel header should be visible
    await expect(page.getByRole("heading", { name: /Quests · Achievements/i })).toBeVisible({ timeout: 15_000 });

    // first_mint reward = 0.50 AEV — unique amongst quests, so we can target it directly
    const claimBtn = page.getByRole("button", { name: /Claim \+0\.50 AEV/i }).first();
    await claimBtn.waitFor({ state: "visible", timeout: 10_000 });
    await claimBtn.click();

    // Wallet balance should now be > 0.5 (0.05 seeded + 0.5 reward) — read from localStorage
    await expect.poll(async () => {
      return await page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return 0;
        try { return (JSON.parse(raw).balance ?? 0) as number } catch { return 0 }
      }, WALLET_KEY);
    }, { timeout: 5_000 }).toBeGreaterThan(0.5);

    // Persisted claimed list should include first_mint
    const claimed = await page.evaluate((k) => {
      const raw = window.localStorage.getItem(k);
      if (!raw) return [] as string[];
      try { return JSON.parse(raw) as string[] } catch { return [] }
    }, CLAIMED_KEY);
    expect(claimed).toContain("first_mint");
  });
});
