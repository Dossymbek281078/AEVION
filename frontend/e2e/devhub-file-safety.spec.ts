import { test, expect } from "@playwright/test";

/**
 * DevHub IDE — the clicks that used to destroy a file.
 *
 * Three real defects, all of the same shape: a write that looked like it
 * worked while the file was gone.
 *   1. "Save URL to File" in the Media tab replaced the whole open file with
 *      the URL. Open App.jsx, generate an image, press it, app gone.
 *   2. "New file" with a path that already exists sent content:"" to an
 *      upsert endpoint — that empties the existing file rather than creating.
 *   3. The file PUT's response was never checked. A 404 (project deleted in
 *      another tab, no edit rights) let the editor keep autosaving into the
 *      void with no indication at all.
 *
 * The backend is mocked, so these are deterministic and free: what is asserted
 * is the request the IDE makes (or refuses to make), which is exactly where
 * each defect lived.
 */

const PROJECT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const APP_JSX = `export default function App() {
  return <div className="app">hello</div>;
}
`;

const FILES = [{ id: "f1", path: "src/App.jsx", content: APP_JSX, language: "javascript" }];

type Put = { path: string; content: string };

/** Mock the whole DevHub API and record every file write. */
async function mockBackend(
  page: import("@playwright/test").Page,
  opts: { putStatus?: number; collaboratorDeleteStatus?: number; collaboratorAddStatus?: number } = {},
) {
  const puts: Put[] = [];
  const deletes: string[] = [];

  await page.route("**/api/devhub/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/collaborators") && req.method() === "POST") {
      const status = opts.collaboratorAddStatus ?? 200;
      // A failed add carries no list — the UI used to apply it anyway.
      return json(status === 200 ? { collaborators: [{ userId: "new@example.com", role: "editor" }] } : { error: "nope" }, status);
    }
    if (url.includes("/collaborators/")) {
      const status = opts.collaboratorDeleteStatus ?? 200;
      deletes.push(url);
      return json(status === 200 ? { ok: true } : { error: "nope" }, status);
    }
    if (url.includes("/file")) {
      const path = new URL(url).searchParams.get("path") || "";
      if (req.method() === "DELETE") {
        deletes.push(path);
        return json({ ok: true });
      }
      if (req.method() === "PUT") {
        const body = JSON.parse(req.postData() || "{}");
        puts.push({ path, content: String(body.content ?? "") });
        const status = opts.putStatus ?? 200;
        if (status !== 200) return json({ error: "nope" }, status);
        return json({ file: { id: `n-${puts.length}`, path, content: body.content, language: body.language } });
      }
    }
    if (url.includes("/media/image")) {
      return json({ ok: true, url: "https://cdn.example/generated.png" });
    }
    if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: {
          id: PROJECT_ID,
          name: "file-safety-e2e",
          description: "",
          stack: "react",
          deployUrl: null,
          userId: "anonymous",
          collaborators: [{ userId: "teammate@example.com", role: "editor" }],
        },
        files: FILES,
      });
    }
    if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
    if (url.includes("/templates")) return json({ templates: [] });
    if (url.includes("/deployments")) return json({ deployments: [] });
    return json({ ok: true });
  });

  return { puts, deletes };
}

test.describe("DevHub — writes that must not lose a file", () => {
  test("inserting a generated image appends to the open file instead of replacing it", async ({ page }) => {
    const { puts } = await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("button", { name: "Media", exact: true }).click();
    await page.getByRole("button", { name: "DALL-E", exact: true }).click();
    await page.getByPlaceholder(/serene mountain landscape/i).fill("a cat");
    await page.getByRole("button", { name: "Generate Image" }).click();

    const insert = page.getByRole("button", { name: "Insert into file" });
    await expect(insert).toBeVisible({ timeout: 15_000 });
    await insert.click();

    const written = puts.filter((p) => p.path === "src/App.jsx");
    expect(written.length).toBeGreaterThan(0);
    const last = written[written.length - 1].content;
    // The regression: this used to be exactly the URL and nothing else.
    expect(last).toContain("export default function App()");
    expect(last).toContain('<img src="https://cdn.example/generated.png" alt="" />');
    expect(last.length).toBeGreaterThan(APP_JSX.length);
  });

  test("creating a file that already exists is refused, not sent as an empty write", async ({ page }) => {
    const { puts } = await mockBackend(page);
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByTitle("New file").click();
    await page.getByPlaceholder("src/component.tsx").fill("src/App.jsx");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText(/уже существует/)).toBeVisible();
    // Nothing may reach the server: the endpoint is an upsert, and an empty
    // write to an existing path is how the file got emptied.
    expect(puts.filter((p) => p.content === "")).toHaveLength(0);
  });

  test("a rejected save says so and keeps saying so", async ({ page }) => {
    const { puts } = await mockBackend(page, { putStatus: 404 });
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("button", { name: "Media", exact: true }).click();
    await page.getByRole("button", { name: "DALL-E", exact: true }).click();
    await page.getByPlaceholder(/serene mountain landscape/i).fill("a cat");
    await page.getByRole("button", { name: "Generate Image" }).click();
    await page.getByRole("button", { name: "Insert into file" }).click({ timeout: 15_000 });

    expect(puts.length).toBeGreaterThan(0); // the write was attempted...
    // ...and refused, so the header must admit it — a toast would have faded
    // while the file stayed unsaved.
    await expect(page.getByText(/НЕ сохранён/)).toBeVisible({ timeout: 10_000 });
  });

  test("a collaborator the server refused to remove stays on the list", async ({ page }) => {
    const { deletes } = await mockBackend(page, { collaboratorDeleteStatus: 500 });
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const row = page.getByTitle("teammate@example.com");
    await expect(row).toBeVisible();

    await page.getByTitle("Remove collaborator").click();
    await expect(page.getByText(/Доступ НЕ отозван/)).toBeVisible({ timeout: 10_000 });
    expect(deletes.length).toBe(1);
    // Their access is still live on the server; a list that hides them is
    // worse than the error.
    await expect(row).toBeVisible();
  });

  test("a project the server refused to delete stays on the shelf", async ({ page }) => {
    // The delete endpoint answers 502 on purpose when the project's database
    // or Railway service could not be removed. Dropping the card anyway hides
    // a live schema, login role and billable container.
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (route.request().method() === "DELETE" && url.includes("/projects/")) {
        return json({ error: "project not deleted — its database could not be dropped: connection refused" }, 502);
      }
      if (url.includes("/projects")) {
        return json({
          projects: [{ id: PROJECT_ID, name: "undeletable", description: "", stack: "react", status: "draft", updatedAt: new Date(0).toISOString(), fileCount: 1 }],
        });
      }
      if (url.includes("/snippets")) return json({ snippets: [] });
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      if (url.includes("/templates")) return json({ templates: [] });
      return json({ ok: true });
    });
    page.on("dialog", (d) => d.accept());

    await page.goto("/devhub");
    const card = page.getByText("undeletable", { exact: true });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Delete", exact: true }).first().click();
    await expect(page.getByText(/could not be dropped/)).toBeVisible({ timeout: 10_000 });
    await expect(card).toBeVisible();
  });

  test("a refused save offers the work back as a download", async ({ page }) => {
    await mockBackend(page, { putStatus: 404 });
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("button", { name: "Media", exact: true }).click();
    await page.getByRole("button", { name: "DALL-E", exact: true }).click();
    await page.getByPlaceholder(/serene mountain landscape/i).fill("a cat");
    await page.getByRole("button", { name: "Generate Image" }).click();
    await page.getByRole("button", { name: "Insert into file" }).click({ timeout: 15_000 });
    await expect(page.getByText(/НЕ сохранён/)).toBeVisible({ timeout: 10_000 });

    // At this point the text exists only in this tab. It has to be able to
    // leave it.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Скачать копию/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("App.jsx");
  });

  test("a failed collaborator add does not wipe the people already on the project", async ({ page }) => {
    await mockBackend(page, { collaboratorAddStatus: 500 });
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const existing = page.getByTitle("teammate@example.com");
    await expect(existing).toBeVisible();

    await page.getByPlaceholder("email or user-id").fill("new@example.com");
    await page.getByRole("button", { name: "Invite", exact: true }).click();

    await expect(page.getByText(/Соавтор НЕ добавлен/)).toBeVisible({ timeout: 10_000 });
    // The list must survive: the failed response carries no collaborators, and
    // applying it emptied the screen while claiming success.
    await expect(existing).toBeVisible();
  });

  test("a failed env read says so instead of showing an empty project", async ({ page }) => {
    // "Could not load" is not the same fact as "there are none": the env list
    // swallowed its error and rendered empty, so a failed read looked like a
    // project with no variables at all.
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/env")) return json({ error: "nope" }, 500);
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "env-read", description: "", stack: "react", deployUrl: null, userId: "anonymous", collaborators: [] },
          files: FILES,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("button", { name: "Env Vars", exact: true }).click();
    await expect(page.getByText(/не загрузился/)).toBeVisible({ timeout: 10_000 });
  });

  test("a refused env var save does not report the value as stored", async ({ page }) => {
    await page.route("**/api/devhub/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/env") && req.method() === "PUT") return json({ error: "nope" }, 500);
      if (url.includes("/env")) return json({ env: [] });
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "env", description: "", stack: "react", deployUrl: null, userId: "anonymous", collaborators: [] },
          files: FILES,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("button", { name: "Env Vars", exact: true }).click();
    const key = page.getByPlaceholder(/KEY|ключ/i).first();
    await expect(key).toBeVisible({ timeout: 15_000 });
    await key.fill("DATABASE_URL");
    await page.getByRole("button", { name: /^(Add|Save|Добав)/i }).first().click();

    // Green "Env var saved" here is how a value that never reached the server
    // looked stored — a deploy would then run without it.
    await expect(page.getByText(/Переменная НЕ сохранена/)).toBeVisible({ timeout: 10_000 });
  });

  test("the file context menu actually acts, and a refused delete keeps the file", async ({ page }) => {
    // Two defects in one flow. The menu closed on mousedown — including
    // mousedown INSIDE it — so the click never reached the button and Rename
    // and Delete did nothing at all. And when Delete did run, the tree dropped
    // the file whatever the server answered.
    await page.route("**/api/devhub/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/file") && req.method() === "DELETE") return json({ error: "nope" }, 500);
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "del", description: "", stack: "react", deployUrl: null, userId: "anonymous", collaborators: [] },
          files: FILES,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      return json({ ok: true });
    });
    page.on("dialog", (d) => d.accept()); // deleteFile() asks for confirmation

    await page.goto(`/devhub/${PROJECT_ID}`);
    const row = page.getByText("src/App.jsx", { exact: true }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click({ button: "right" });

    const menu = page.locator('div[style*="position: fixed"]').filter({ hasText: "Rename" });
    await menu.getByRole("button", { name: "Delete", exact: true }).click();

    // The menu acted at all — before the fix nothing here ever fired.
    await expect(page.getByText(/Файл НЕ удалён/)).toBeVisible({ timeout: 10_000 });
    await expect(row).toBeVisible();
  });

  test("renaming onto an existing file is refused, and neither file is touched", async ({ page }) => {
    // Only reachable at all since the context menu was fixed: before that,
    // right-click → Rename did nothing, so this guard had never run for a user.
    const TWO = [
      ...FILES,
      { id: "f2", path: "src/Timer.jsx", content: "timer", language: "javascript" },
    ];
    const writes: string[] = [];
    const deletes: string[] = [];
    await page.route("**/api/devhub/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes("/file")) {
        if (req.method() === "PUT") writes.push(url);
        if (req.method() === "DELETE") deletes.push(url);
      }
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: TWO });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "ren", description: "", stack: "react", deployUrl: null, userId: "anonymous", collaborators: [] },
          files: TWO,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    const row = page.getByText("src/Timer.jsx", { exact: true }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click({ button: "right" });

    const menu = page.locator('div[style*="position: fixed"]').filter({ hasText: "Rename" });
    await menu.getByRole("button", { name: "Rename", exact: true }).click();

    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("src/App.jsx");
    await input.press("Enter");

    await expect(page.getByText(/уже существует/)).toBeVisible({ timeout: 10_000 });
    // Nothing may move: a rename onto an occupied path used to overwrite it.
    expect(writes).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });
});
