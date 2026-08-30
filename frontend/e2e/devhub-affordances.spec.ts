import { test, expect } from "@playwright/test";

/**
 * Does each control in the IDE actually do anything?
 *
 * Written after finding that right-click → Rename / Delete in the file tree
 * had never worked: the menu closed on mousedown before the click landed, so
 * both entries were dead in a real browser while every unit test passed. That
 * class of defect — a control that renders, reacts to hover, and does nothing —
 * is invisible to anything short of driving the page.
 *
 * Each case here clicks one control and asserts an effect a user would see.
 * The backend is mocked, so the cases stay deterministic and free.
 */

const PROJECT_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

const FILES = [
  { id: "f1", path: "src/App.jsx", content: "export default () => null;", language: "javascript" },
  { id: "f2", path: "src/Timer.jsx", content: "export default () => null;", language: "javascript" },
];

const CHECKPOINTS = [
  { id: "c1", label: "generate: add a timer", createdAt: new Date(0).toISOString(), paths: ["src/Timer.jsx"] },
];

async function mockBackend(page: import("@playwright/test").Page) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/checkpoints")) return json({ checkpoints: CHECKPOINTS });
    if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: {
          id: PROJECT_ID, name: "affordances", description: "", stack: "react",
          deployUrl: null, userId: "anonymous", collaborators: [],
        },
        files: FILES,
      });
    }
    if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
    if (url.includes("/templates")) return json({ templates: [] });
    if (url.includes("/deployments")) return json({ deployments: [] });
    return json({ ok: true });
  });
}

test.describe("DevHub IDE — controls that must not be decorative", () => {
  test("+ opens the new-file field", async ({ page }) => {
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByTitle("New file").click({ timeout: 30_000 });
    await expect(page.getByPlaceholder("src/component.tsx")).toBeVisible();
  });

  test("History lists the project's checkpoints", async ({ page }) => {
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    // The toggle lives inside the AI Generate tab, which is the default —
    // but click it explicitly so the case does not depend on that staying true.
    await page.getByRole("tab", { name: "AI Generate", exact: true }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.getByText("generate: add a timer")).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a file in the tree opens it in the editor", async ({ page }) => {
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByText("src/Timer.jsx", { exact: true }).first().click({ timeout: 30_000 });
    // The selected path shows up in the editor header area.
    await expect(page.getByText("src/Timer.jsx").first()).toBeVisible();
  });

  test("the right-click menu's Rename opens an editable field", async ({ page }) => {
    // The regression this whole file exists for.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    const row = page.getByText("src/Timer.jsx", { exact: true }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click({ button: "right" });
    const menu = page.locator('div[style*="position: fixed"]').filter({ hasText: "Rename" });
    await menu.getByRole("button", { name: "Rename", exact: true }).click();
    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("Undo last AI change actually asks the server to undo", async ({ page }) => {
    await mockBackend(page);
    const undoCalls: string[] = [];
    await page.route("**/generate/undo", async (route) => {
      undoCalls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, label: "generate: add a timer", revertedFiles: ["src/Timer.jsx"] }),
      });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "AI Generate", exact: true }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /Undo last AI change/ }).click();

    expect(undoCalls).toHaveLength(1);
    await expect(page.getByText(/Reverted/)).toBeVisible({ timeout: 10_000 });
  });

  test("Revert to here in History sends a restore for that checkpoint", async ({ page }) => {
    await mockBackend(page);
    const restores: string[] = [];
    await page.route("**/checkpoints/*/restore", async (route) => {
      restores.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, revertedFiles: ["src/Timer.jsx"], restoredToLabel: "generate: add a timer", stepsApplied: 1 }),
      });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "AI Generate", exact: true }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /History/ }).click();
    // The newest entry is labelled just "Revert"; older ones say "Revert to here".
    await page.getByRole("button", { name: /^Revert/ }).first().click();

    expect(restores).toHaveLength(1);
    expect(restores[0]).toContain("/checkpoints/c1/restore");
  });

  test("rename is reachable without knowing about right-click", async ({ page }) => {
    // It used to live only in the context menu — which most people never try
    // in a web app, and which no keyboard can reach. Delete already had a row
    // button; rename now does too.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    const row = page.getByText("src/Timer.jsx", { exact: true }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await page.getByTitle("Rename file").first().click();
    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test("a file can be opened from the keyboard", async ({ page }) => {
    // The rows were plain divs: nothing on the page could be reached by Tab,
    // so opening a file — the first thing anyone does in the IDE — was
    // mouse-only.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    const row = page.getByRole("button", { name: "Открыть src/Timer.jsx" });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press("Enter");

    // Opening a file marks its row as the pressed one.
    await expect(row).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  });

  test("a failure message is announced, not just drawn", async ({ page }) => {
    // Every honest failure message added to this page — the file that was not
    // saved, the collaborator whose access was not revoked — was silent to a
    // screen reader: the local Toast carried no live region at all.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByTitle("New file").click({ timeout: 30_000 });
    await page.getByPlaceholder("src/component.tsx").fill("src/App.jsx"); // already exists
    await page.getByRole("button", { name: "Create", exact: true }).click();

    const toast = page.getByRole("status").filter({ hasText: /уже существует/ });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  test("the panel tabs behave like tabs, including arrow keys", async ({ page }) => {
    // They were nine plain buttons: announced as unrelated controls, and arrow
    // keys did nothing.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible({ timeout: 30_000 });

    const chat = page.getByRole("tab", { name: "AI Generate" });
    await expect(chat).toHaveAttribute("aria-selected", "true");
    await chat.focus();
    await page.keyboard.press("ArrowRight");

    const visual = page.getByRole("tab", { name: /Visual Edit/ });
    await expect(visual).toHaveAttribute("aria-selected", "true");
    await expect(visual).toBeFocused();
    // And the panel says which tab it belongs to.
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "devhub-tab-visual");
  });

  test("the media sub-tabs are tabs too, arrow keys included", async ({ page }) => {
    // Seventeen plain buttons in a row before this: Tab stopped on each one,
    // arrows did nothing, and a screen reader heard no relationship between
    // them.
    await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "Media", exact: true }).click({ timeout: 30_000 });

    const video = page.getByRole("tab", { name: "Video AI", exact: true });
    await expect(video).toHaveAttribute("aria-selected", "true");
    await video.focus();
    await page.keyboard.press("ArrowRight");

    const threeD = page.getByRole("tab", { name: "3D", exact: true });
    await expect(threeD).toHaveAttribute("aria-selected", "true");
    await expect(threeD).toBeFocused();
  });

  test("the aevion.build domain is only promised when the server says it works", async ({ page }) => {
    // The zone was never delegated, so the IDE promised an address that failed
    // DNS — in four places, months after the shop window stopped doing it.
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/studio/capabilities")) {
        return json({
          capabilities: [
            { id: "domain", name: "Domain (aevion.build)", status: "degraded", lastError: "zone is not delegated" },
            { id: "pages", name: "Cloudflare Pages", status: "live" },
          ],
        });
      }
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "dom", description: "", stack: "static", deployUrl: null, userId: "anonymous", collaborators: [] },
          files: FILES,
        });
      }
      if (url.includes("/deployments")) return json({ deployments: [] });
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "Deployments", exact: true }).click({ timeout: 30_000 });

    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("Cloudflare Pages");
    await expect(panel).toContainText("pages.dev");
    // The promise itself must be gone while the capability is degraded.
    await expect(panel).not.toContainText("aevion.build domain included");
    await expect(page.getByRole("button", { name: /get aevion\.build domain/ })).toHaveCount(0);
  });
});
