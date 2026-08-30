import { test, expect } from "@playwright/test";

/**
 * The comparison page is the easiest place in a product to lie by accident,
 * and the first thing an investor or a journalist checks. These cases pin the
 * three properties that make it worth publishing at all:
 *
 *  - every claim shows where it came from, and unmeasured stays unmeasured;
 *  - our own live state comes from the server, not from the copy;
 *  - the section naming where we are behind is actually on the page.
 */

const CAPS = [
  { id: "code", name: "Code generation", status: "live" },
  { id: "database", name: "Project database", status: "live" },
  { id: "video", name: "Video Generation", status: "degraded", lastError: "Replicate: no credit" },
];

async function mock(page: import("@playwright/test").Page, capabilities: unknown[]) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/studio/capabilities")) return json({ capabilities });
    return json({ ok: true });
  });
}

test.describe("Comparison page — a table that can be checked", () => {
  test("our live count comes from the server, not from the copy", async ({ page }) => {
    await mock(page, CAPS);
    await page.goto("/compare");
    await expect(page.getByText(/работает 2 из 3 возможностей/)).toBeVisible({ timeout: 30_000 });
  });

  test("what we have not measured says so, in our column and theirs", async ({ page }) => {
    await mock(page, CAPS);
    await page.goto("/compare");
    // "Deploy names the address only after checking" — nobody else was measured.
    const row = page.getByRole("row").filter({ hasText: /только после проверки/ });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText("не измеряли")).toHaveCount(4);
  });

  test("the media row admits it is broken right now", async ({ page }) => {
    await mock(page, CAPS);
    await page.goto("/compare");
    const row = page.getByRole("row").filter({ hasText: /Медиа прямо в редакторе/ });
    await expect(row.getByText(/сейчас не работает/)).toBeVisible({ timeout: 30_000 });
  });

  test("the section naming where we are behind is on the page", async ({ page }) => {
    await mock(page, CAPS);
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: /Где мы слабее/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Экосистема и узнаваемость/)).toBeVisible();
  });

  test("the savings claim stays honest about what was not measured", async ({ page }) => {
    await mock(page, CAPS);
    await page.goto("/compare");
    await expect(page.getByText(/\$162/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/мы не мерили и потому не пишем/)).toBeVisible();
  });

  test("the ecosystem table names what is missing instead of inventing an edge", async ({ page }) => {
    // The founder asked for every module with an analogue. Only a few have
    // facts, and the page has to say that rather than fill the gaps.
    await mock(page, CAPS);
    await page.goto("/compare");

    const chess = page.getByRole("row").filter({ hasText: "CyberChess" });
    await expect(chess).toBeVisible({ timeout: 30_000 });
    await expect(chess.getByText(/476 ходов/)).toBeVisible();
    await expect(chess.getByText(/не сравнивали/)).toBeVisible();

    // QReal carries the standing decision not to publish a comparison.
    const qreal = page.getByRole("row").filter({ hasText: "QReal Studio" });
    await expect(qreal.getByText(/публиковать его нельзя/)).toBeVisible();

    // And the rest are named as needing a measurement, not given an advantage.
    const rest = page.getByRole("row").filter({ hasText: "Остальные модули" });
    await expect(rest.getByText(/нужен замер/)).toBeVisible();
  });

  test("on a phone the comparison is readable without sideways scrolling", async ({ page }) => {
    // A five-column table 1270px wide, read through a 390px window, is not
    // reading. The same rows render as stacked cards below 780px.
    await page.setViewportSize({ width: 390, height: 844 });
    await mock(page, CAPS);
    await page.goto("/compare");

    // The table is out of the way and the cards carry the same content.
    await expect(page.locator(".cmp-wide")).toBeHidden({ timeout: 30_000 });
    const cards = page.locator(".cmp-narrow");
    await expect(cards).toBeVisible();
    await expect(cards.getByText("Скриншот → код")).toBeVisible();
    await expect(cards.getByText(/Медиа прямо в редакторе/)).toBeVisible();

    // And the page itself still does not scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test("on a wide screen it is the table, not the cards", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mock(page, CAPS);
    await page.goto("/compare");
    await expect(page.locator(".cmp-wide")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".cmp-narrow")).toBeHidden();
  });
});
