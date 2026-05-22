import { test, expect } from "@playwright/test";

// Regression smoke: the AppShellLanguagePill must render on every app-shell
// route where SiteHeader is suppressed by ClientProviders.tsx (see commit
// ba0328d5). Covers ~98 sub-pages indirectly — sampling one URL per app
// shell is sufficient because the pill is mounted once in ClientProviders.
//
// Runs locally by default (against `next start -p 3100`). To verify prod,
// invoke with: PLAYWRIGHT_BASE_URL=https://aevion.app npx playwright test
// e2e/i18n-pill.spec.ts.

const APP_SHELL_URLS = [
  "/cyberchess/training",
  "/qcoreai/settings",
  "/build/dashboard",
];

for (const url of APP_SHELL_URLS) {
  test(`pill mounted on ${url}`, async ({ page }) => {
    await page.goto(url);

    const pill = page.locator('[data-app-shell-pill="true"]');
    await expect(pill).toBeVisible();

    const trigger = pill.locator('button[aria-haspopup="listbox"]');
    await expect(trigger).toBeVisible();

    // Opening the dropdown is the load-bearing assertion: confirms the
    // LanguageSwitcher inside is wired to its I18nProvider state.
    await trigger.click();
    const listbox = pill.locator('[role="listbox"]');
    await expect(listbox).toBeVisible();
    await expect(listbox.locator('[role="option"]')).toHaveCount(11);
  });
}
