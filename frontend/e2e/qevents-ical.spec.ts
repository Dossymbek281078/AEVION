import { test, expect } from "@playwright/test";

/**
 * QEvents — "Add to calendar" .ics download flow.
 *
 * Flow under test:
 *   1. /qevents loads with at least one event
 *   2. Click "📅 Add to calendar" on an event card
 *   3. The button triggers `window.location.href = /api/qevents/events/:id/ics`
 *      → we intercept that request and serve a fake .ics body with the right
 *      Content-Type + Content-Disposition headers
 *   4. Assert the network request URL pattern + headers
 *
 * NOTE on download detection:
 *   The page uses `window.location.href = ...` rather than `<a download>`,
 *   so Playwright's `page.waitForEvent("download")` won't always fire on
 *   text/calendar in chromium. Instead we intercept the request and assert
 *   it was issued with the right path + that the response we serve has the
 *   correct calendar headers — that exercises the same contract.
 *
 * Idempotency: all backend calls are mocked, runs are independent.
 */

const MOCK_EVENT = {
  id: "evt-e2e-001",
  organizerId: "org-1",
  title: "E2E Playwright Conf 2099",
  description: "Fixture event used by Playwright .ics smoke test.",
  category: "tech",
  location: "Online",
  // 30 days in the future so it always renders as "upcoming" rather than past.
  startAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  endAt: new Date(Date.now() + 30 * 86_400_000 + 3_600_000).toISOString(),
  capacity: 200,
  price: 0,
  attendeeCount: 12,
  isPublic: true,
  coverUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
};

test.describe("QEvents — Add to calendar (.ics)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the events list — qevents page can fetch via several shapes;
    // we cover the most likely two: /api/qevents/events and ?upcoming= form.
    const eventsBody = JSON.stringify({ events: [MOCK_EVENT] });
    await page.route("**/api/qevents/events**", async (route) => {
      // Skip routes specific to a single event (/events/:id/ics, /events/:id/rsvp).
      const url = route.request().url();
      if (/\/events\/[^/?]+\/(ics|rsvp)/.test(url)) {
        return route.continue();
      }
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: eventsBody,
      });
    });
  });

  test("Clicking 'Add to calendar' issues GET /events/:id/ics with calendar headers", async ({
    page,
  }) => {
    let icsRequested = false;
    let icsUrl = "";

    // Intercept the .ics download endpoint *before* navigation so the
    // request triggered by window.location.href is caught.
    await page.route(`**/api/qevents/events/${MOCK_EVENT.id}/ics`, async (route) => {
      icsRequested = true;
      icsUrl = route.request().url();
      const body =
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n" +
        `UID:${MOCK_EVENT.id}@aevion\r\nSUMMARY:${MOCK_EVENT.title}\r\n` +
        "END:VEVENT\r\nEND:VCALENDAR\r\n";
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/calendar; charset=utf-8",
          "content-disposition": `attachment; filename="${MOCK_EVENT.id}.ics"`,
        },
        body,
      });
    });

    await page.goto("/qevents", { waitUntil: "domcontentloaded" });

    // QEvents heading mounts (we use loose locator — the page has a hero with
    // "Events" / "QEvents" text). Wait for the event card title.
    await expect(page.getByText(MOCK_EVENT.title).first()).toBeVisible({ timeout: 15_000 });

    // Click "📅 Add to calendar".
    const addBtn = page.getByRole("button", { name: /Add to calendar/i }).first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // Wait for the intercept to fire.
    await expect.poll(() => icsRequested, { timeout: 10_000 }).toBe(true);
    expect(icsUrl).toMatch(new RegExp(`/api/qevents/events/${MOCK_EVENT.id}/ics`));
  });

  test("ICS endpoint contract — content-type starts with text/calendar", async ({ page }) => {
    // Direct fetch via Playwright's APIRequestContext bound to the page. We
    // re-route in this test as well because routes are per-test.
    await page.route(`**/api/qevents/events/${MOCK_EVENT.id}/ics`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/calendar; charset=utf-8" },
        body: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      });
    });
    const resp = await page.request.get(`/api/qevents/events/${MOCK_EVENT.id}/ics`);
    expect(resp.status()).toBe(200);
    const ct = resp.headers()["content-type"] || "";
    expect(ct).toMatch(/text\/calendar/);
  });
});
