import { test, expect } from "@playwright/test";

/**
 * The visible end of the honesty layer: the strip on /devhub that says what
 * works right now, before anyone types an idea into a dead feature.
 *
 * It matters more since capabilities started reporting what real calls did
 * rather than whether a key exists — a `degraded` state now reaches this strip
 * carrying the provider's own reason, and that reason is the whole point.
 */

const CAPS = [
  { id: "code", name: "Code generation", status: "live" },
  { id: "database", name: "Project database", status: "live" },
  { id: "video", name: "Video Generation", status: "degraded", lastError: "Replicate: no credit on the account" },
  { id: "domain", name: "Domain (aevion.build)", status: "degraded", lastError: "the zone is not delegated to Cloudflare" },
  { id: "sms", name: "SMS", status: "needs_token", token: "BREVO_API_KEY" },
];

async function mockShelf(page: import("@playwright/test").Page, capabilities: unknown[]) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/studio/capabilities")) return json({ capabilities });
    if (url.includes("/snippets")) return json({ snippets: [] });
    if (url.includes("/projects")) return json({ projects: [] });
    return json({ ok: true });
  });
}

test.describe("DevHub shelf — the strip tells the truth on the way in", () => {
  test("counts what works and names the reason each broken one gave", async ({ page }) => {
    await mockShelf(page, CAPS);
    await page.goto("/devhub");

    await expect(page.getByText("Сейчас работает: 2 из 5")).toBeVisible({ timeout: 30_000 });

    // The reason is the provider's own words, carried through to a tooltip —
    // "temporarily unavailable" on its own would be no better than silence.
    const video = page.getByText("Video Generation", { exact: true });
    await expect(video).toBeVisible();
    await expect(video.locator("xpath=..")).toHaveAttribute("title", /no credit/i);

    const domain = page.getByText("Domain (aevion.build)", { exact: true });
    await expect(domain.locator("xpath=..")).toHaveAttribute("title", /not delegated/i);

    // A capability that was never configured says so, rather than borrowing a
    // failure it never had.
    const sms = page.getByText("SMS", { exact: true });
    await expect(sms.locator("xpath=..")).toHaveAttribute("title", /не настроено/i);
  });

  test("says so plainly when everything answers", async ({ page }) => {
    await mockShelf(page, [
      { id: "code", name: "Code generation", status: "live" },
      { id: "database", name: "Project database", status: "live" },
    ]);
    await page.goto("/devhub");

    await expect(page.getByText("Сейчас работает: 2 из 2")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("все интеграции отвечают")).toBeVisible();
  });

  test("stays silent until the server has answered", async ({ page }) => {
    // Guessing here would be its own small lie; the strip renders only on data.
    await mockShelf(page, []);
    await page.goto("/devhub");

    await expect(page.getByRole("button", { name: /New Project/ }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Сейчас работает:/)).toHaveCount(0);
  });

  test("the comparison is reachable from where the live state is shown", async ({ page }) => {
    // The table is only worth anything next to the thing that proves it: the
    // live count. Burying it on a marketing page would separate the two.
    await mockShelf(page, CAPS);
    await page.goto("/devhub");
    const link = page.getByRole("link", { name: /рядом с Bolt, Lovable, v0 и Replit/ });
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveAttribute("href", "/compare");
  });
});
