import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility audit using axe-core. Fails if any "serious" or "critical"
// violations are found on the production-build pages /aev or /qtrade.
// We skip "minor" / "moderate" — those become a separate hardening pass.

const RULES_TO_RUN = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function runAudit(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(RULES_TO_RUN)
    .analyze();
  const blocking = results.violations.filter((v) =>
    v.impact === "serious" || v.impact === "critical"
  );
  return { blocking, all: results.violations };
}

test.describe("Accessibility audit", () => {
  test("/aev has no serious/critical axe violations", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/aev", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const { blocking } = await runAudit(page);
    if (blocking.length > 0) {
      console.log(JSON.stringify(blocking.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(blocking, "no serious/critical a11y violations").toEqual([]);
  });

  test("/qtrade has no serious/critical axe violations", async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.clear() } catch {}
    });
    await page.goto("/qtrade", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const { blocking } = await runAudit(page);
    if (blocking.length > 0) {
      console.log(JSON.stringify(blocking.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(blocking, "no serious/critical a11y violations").toEqual([]);
  });
});
