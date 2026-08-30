import { test, expect } from "@playwright/test";

/**
 * The saved cache must hold translations, not echoes.
 *
 * Measured on production 28.07.2026: 39 module captions on the home page were
 * served back unchanged to every German visitor — the server had cached an
 * identity answer from an earlier bad moment, and the same strings sent fresh
 * translated fine. The client kept its own copy of those echoes in
 * localStorage, so even a recovered service would not have fixed the page for
 * anyone who had already visited.
 */
const KEY = "aevion_tr_v1_de";

async function readCache(page: import("@playwright/test").Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}") as Record<string, string>, KEY);
}

async function switchToGerman(page: import("@playwright/test").Page) {
  await page.goto("/devhub", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /(EN|RU|KK|DE)/ }).first().click();
  await page.getByRole("option", { name: /Deutsch/ }).click();
  await page.waitForTimeout(6000);
}

test("an echo of the source is never saved", async ({ page }) => {
  test.setTimeout(180_000);
  await page.route("**/api/i18n/translate", async (route) => {
    const body = route.request().postDataJSON() as { texts: string[] };
    // Echo everything — what a failing engine looks like from here.
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ translations: body.texts }),
    });
  });

  await switchToGerman(page);
  const cache = await readCache(page);
  const echoes = Object.entries(cache).filter(([k, v]) => k === v);
  expect(echoes, "nothing that came back unchanged may be written to storage").toEqual([]);
});

test("a real translation is saved, so it is not re-fetched forever", async ({ page }) => {
  test.setTimeout(180_000);
  await page.route("**/api/i18n/translate", async (route) => {
    const body = route.request().postDataJSON() as { texts: string[] };
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        translations: body.texts.map((t) => (t === "AEVION 2026 · 12345" ? t : `DE:${t.slice(0, 20)}`)),
      }),
    });
  });

  await switchToGerman(page);
  const cache = await readCache(page);
  const saved = Object.entries(cache).filter(([, v]) => v.startsWith("DE:"));
  expect(saved.length, "translations are still cached as before").toBeGreaterThan(0);
});
