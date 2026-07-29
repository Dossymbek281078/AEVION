import { test, expect } from "@playwright/test";

/**
 * three.js must not ride along on pages that show no globe.
 *
 * Measured 28.07.2026: /devhub and /compare carried the 748 KB three chunk in
 * their own <script> tags — the bundler had folded it into a group they share
 * with the home page, which is the only page with a globe. Loading the globe on
 * demand took the shelf from 6723 KB to 6013 KB of JavaScript.
 *
 * The globe itself still has to arrive, so this checks both halves.
 */
test("pages without a globe do not ship the 3D library", async ({ page }) => {
  test.setTimeout(120_000);
  for (const p of ["/devhub", "/compare"]) {
    await page.goto(p, { waitUntil: "networkidle" });
    // Chunk names are content-hashed, so the honest check is the weight the
    // page actually pulls: with three.js folded in it was 6723 KB, without it
    // 6013 KB. A budget catches the regression whatever the chunk is called.
    const kb = await page.evaluate(() => {
      let total = 0;
      for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
        if (e.name.endsWith(".js")) total += e.decodedBodySize / 1024;
      }
      return Math.round(total);
    });
    expect(kb, `${p} stays under the size it had with three.js bundled in`).toBeLessThan(6500);
  }
});

test("the home page still gets its globe", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/", { waitUntil: "networkidle" });
  // The placeholder holds the slot; a canvas appearing proves the lazy chunk
  // resolved and the globe took over.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 45_000 });
});
