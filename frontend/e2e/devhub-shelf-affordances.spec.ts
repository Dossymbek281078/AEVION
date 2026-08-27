import { test, expect } from "@playwright/test";

/**
 * The same "does this control actually do anything" check, on the page a new
 * user meets first: the /devhub shelf.
 *
 * A dead control here costs more than anywhere else — it is the first thing
 * someone touches. The IDE's context menu had been dead for who knows how
 * long precisely because nothing drove it in a browser.
 */

const PROJECT_ID = "cccccccc-dddd-eeee-ffff-000000000000";

const PROJECTS = [
  {
    id: PROJECT_ID, name: "shelf-probe", description: "", stack: "react",
    status: "draft", updatedAt: new Date(0).toISOString(), fileCount: 2,
  },
];

const SNIPPETS = [
  { id: "s1", title: "useLocalStorage", language: "javascript", content: "export const x = 1;", tags: ["hooks"], stars: 0 },
];

async function mockBackend(page: import("@playwright/test").Page, sink?: { posts: string[] }) {
  await page.route("**/api/devhub/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (req.method() === "POST" && url.includes("/projects")) {
      sink?.posts.push(req.postData() || "");
      return json({ project: { ...PROJECTS[0], id: "new-1", name: "Made in a test" } }, 201);
    }
    if (url.includes("/snippets")) return json({ snippets: SNIPPETS });
    if (url.includes("/templates")) return json({ templates: [] });
    if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
    if (url.includes("/projects")) return json({ projects: PROJECTS });
    return json({ ok: true });
  });
}

test.describe("DevHub shelf — controls that must not be decorative", () => {
  test("+ New Project opens the creation form", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/devhub");
    await page.getByRole("button", { name: /New Project/ }).click({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Create Project/ })).toBeVisible();
  });

  test("an example idea fills the prompt box instead of running off on its own", async ({ page }) => {
    // Deliberate design: examples fill the field so the user sees what will be
    // built before anything starts. A click that launched a build would be a
    // different (and worse) product decision, so assert the intended one.
    await mockBackend(page);
    await page.goto("/devhub");
    const example = page.locator("button").filter({ hasText: /лендинг|трекер|портфолио/i }).first();
    await expect(example).toBeVisible({ timeout: 30_000 });
    const text = (await example.textContent())?.trim() ?? "";
    await example.click();
    const box = page.locator("textarea").first();
    await expect(box).toHaveValue(new RegExp(text.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("Create Project sends the form to the server", async ({ page }) => {
    const sink = { posts: [] as string[] };
    await mockBackend(page, sink);
    await page.goto("/devhub");
    await page.getByRole("button", { name: /New Project/ }).click({ timeout: 30_000 });
    await page.getByPlaceholder(/My Awesome App|название|name/i).first().fill("Made in a test");
    await page.getByRole("button", { name: /Create Project/ }).click();

    await expect.poll(() => sink.posts.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(sink.posts[0]).toContain("Made in a test");
  });

  test("the snippet shelf's Copy button reports what it copied", async ({ page }) => {
    // Headless Chromium denies clipboard writes by default; without this the
    // product correctly shows "Clipboard unavailable" and the button never
    // reports success. Grant it so the case checks the control, not the
    // sandbox.
    await page.context().grantPermissions(["clipboard-write"]);
    await mockBackend(page);
    await page.goto("/devhub");
    const copy = page.getByRole("button", { name: "Copy", exact: true }).first();
    await expect(copy).toBeVisible({ timeout: 30_000 });
    await copy.click();
    await expect(page.getByRole("button", { name: "Copied!", exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("Escape closes the New Project dialog", async ({ page }) => {
    // The backdrop click already closed it; Escape did nothing, so a keyboard
    // had no way out of the dialog at all.
    await mockBackend(page);
    await page.goto("/devhub");
    await page.getByRole("button", { name: /New Project/ }).first().click({ timeout: 30_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test("what you type while the page is still loading is not thrown away", async ({ page }) => {
    // Measured cause (28.07.2026): the page paints and accepts keys before it
    // hydrates. Those characters reach the DOM but no onChange has run, so
    // state is still empty — and the first data-driven re-render writes the
    // empty state back onto the very same node. The input element is never
    // replaced; it is simply blanked a second or two after typing. On a slow
    // phone that window is long enough to lose a whole idea.
    await mockBackend(page);
    await page.goto("/devhub", { waitUntil: "domcontentloaded" });

    // The idea box first: it is the way into the product, so losing text here
    // costs more than losing a snippet.
    const idea = page.getByPlaceholder(/трекер привычек/);
    const title = page.getByPlaceholder("Title");
    const body = page.getByPlaceholder(/paste your snippet here/i);
    await idea.fill("трекер привычек с календарём");
    await title.fill("Typed during load");
    await body.fill("const kept = true;");

    // Give every late fetch time to land and re-render.
    await page.waitForTimeout(2_500);

    await expect(idea).toHaveValue("трекер привычек с календарём");
    await expect(title).toHaveValue("Typed during load");
    await expect(body).toHaveValue("const kept = true;");
  });

  test("the main button admits it cannot work yet instead of pretending", async ({ request, page }) => {
    // Measured 28.07 against the live site on a mid-range phone profile
    // (CPU x6, 1.6 Mbps): painted at 6.9s, first tap answered at 18.7s. For
    // those ~12 seconds "⚡ Построить" and the example chips looked ready and
    // swallowed every tap in silence — the same class of lie as a control that
    // does nothing. The served HTML, which is what a person sees first, must
    // carry the honest state.
    const html = await (await request.get("/devhub")).text();
    const at = html.indexOf("Секунду, загружаюсь…");
    expect(at, "the served HTML must say the page is still loading").toBeGreaterThan(-1);
    const tagStart = html.lastIndexOf("<button", at);
    expect(
      html.slice(tagStart, at),
      "and that button must actually be disabled, not merely labelled",
    ).toContain("disabled");

    // Once the page is alive the label and the button go back to normal.
    await mockBackend(page);
    await page.goto("/devhub");
    const build = page.getByRole("button", { name: /Построить/ });
    await expect(build).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder(/трекер привычек/).fill("лендинг кофейни");
    await expect(build).toBeEnabled();
  });
});
