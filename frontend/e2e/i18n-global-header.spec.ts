import { test, expect } from "@playwright/test";

// Regression smoke: the global SiteHeader (from ClientProviders) must
// render on non-app-shell routes and contain a LanguageSwitcher. This is
// the OTHER half of the i18n coverage — app-shell routes are guarded by
// i18n-pill.spec.ts; everything else (614 - 98 ≈ 500 pages) relies on
// this single global header. If a future commit accidentally widens
// APP_PREFIXES or hides the header CSS-globally, this spec fails fast.
//
// Sample one URL per "global-only" domain pattern (heavy reliance, no
// local Wave1Nav fallback): smeta-trainer has 343 such pages, qpaynet
// has 22, etc.

const GLOBAL_HEADER_URLS = [
  "/smeta-trainer/drawings-practice/airports",
  "/qpaynet",
  "/healthai",
];

for (const url of GLOBAL_HEADER_URLS) {
  test(`global SiteHeader + LanguageSwitcher on ${url}`, async ({ page }) => {
    await page.goto(url);

    // SiteHeader is the sticky banner with the AEVION brand link.
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    await expect(header.getByText("AEVION", { exact: true })).toBeVisible();

    // LanguageSwitcher lives inside that header — opening it confirms
    // the I18nProvider wiring on this route.
    const trigger = header.locator('button[aria-haspopup="listbox"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible();
    await expect(listbox.locator('[role="option"]')).toHaveCount(11);
  });
}
