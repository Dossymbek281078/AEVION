import { test, expect } from "@playwright/test";

test.describe("AEV Tokenomics page", () => {
  test("renders headline + 8-engine pitch + halving section", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/aev/tokenomics", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/AEV · tokenomics & emission policy/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/8 движков · хард-кап 21M/i)).toBeVisible();
    await expect(page.getByText(/Play, Compute, Stewardship/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Wallet/i })).toBeVisible();
  });
});
