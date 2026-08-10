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
async function mockBackend(page: import("@playwright/test").Page, opts: { putStatus?: number } = {}) {
  const puts: Put[] = [];
  const deletes: string[] = [];

  await page.route("**/api/devhub/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

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
});
