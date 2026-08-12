import { test, expect } from "@playwright/test";

/**
 * The Studio usage panel drew a confident empty gauge over a meter the server
 * could not read.
 *
 * `getMonthUsage()` used to answer 0 on a failed database read, and 0 is also
 * the honest answer for a fresh month — so during an outage every bar showed
 * "0 / 10" and every quota gate opened, with nothing anywhere saying the
 * numbers were not a measurement. The server now sends `usedKnown: false` and
 * a `degraded` marker; these specs pin that the panel actually uses them,
 * because a flag nobody renders is the same as no flag.
 */

const CAPS = {
  capabilities: [{ id: "code", name: "Code Editor", description: "d", status: "live" }],
  summary: { total: 1, live: 1, needsToken: 0 },
};

const LIMITS = { video: 3, image: 10, tts: 100000, music: 5, deploy: 10 };

async function mockCredits(page: import("@playwright/test").Page, credits: Record<string, unknown>) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/studio/credits")) return json(credits);
    if (url.includes("/studio/capabilities")) return json(CAPS);
    if (url.includes("/smart/savings")) return json({ runs: 0 });
    return json({ ok: true });
  });
}

function usage(known: boolean, used = 0) {
  const cell = (limit: number) => ({ used, limit, ...(known ? {} : { usedKnown: false }) });
  return {
    video: cell(LIMITS.video), image: cell(LIMITS.image), tts: cell(LIMITS.tts),
    music: cell(LIMITS.music), deploy: cell(LIMITS.deploy),
  };
}

test.describe("Studio — an unread meter is not a meter reading zero", () => {
  test("an unreadable month says so and refuses to print a number", async ({ page }) => {
    await mockCredits(page, {
      tier: "free", month: "2026-08", usage: usage(false),
      degraded: true, degradedReason: "Monthly usage could not be read from the database",
    });

    await page.goto("/studio");

    await expect(page.getByTestId("credits-unreadable")).toBeVisible({ timeout: 20_000 });
    const images = page.getByTestId("usage-Images");
    await expect(images).toHaveAttribute("data-known", "no");
    // "0 / 10" would read as "you have spent nothing this month".
    await expect(images).toContainText("— / 10");
    await expect(images).not.toContainText("0 / 10");
  });

  test("a readable month prints its real number and shows no warning", async ({ page }) => {
    await mockCredits(page, { tier: "free", month: "2026-08", usage: usage(true, 4) });

    await page.goto("/studio");

    const images = page.getByTestId("usage-Images");
    await expect(images).toContainText("4 / 10", { timeout: 20_000 });
    await expect(images).toHaveAttribute("data-known", "yes");
    await expect(page.getByTestId("credits-unreadable")).toHaveCount(0);
  });
});
