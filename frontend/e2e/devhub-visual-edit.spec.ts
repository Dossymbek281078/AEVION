import { test, expect } from "@playwright/test";

/**
 * Visual Edit — click an element in the preview, change it, save.
 *
 * The flagship editing path for static projects, and until now the only proof
 * it worked was a hand-run smoke in July. It is exactly the shape that hides
 * defects from unit tests: an iframe, a postMessage bridge, a pristine source
 * document kept beside the rendered one, and a save that must write the source
 * rather than the rendering.
 *
 * The backend is mocked, so what these cases assert is the request the IDE
 * makes — the same level at which the file-safety defects were caught.
 */

const PROJECT_ID = "77777777-8888-9999-aaaa-bbbbbbbbbbbb";

const INDEX_HTML = `<!DOCTYPE html>
<html>
  <head><title>Probe</title><style>h1 { color: rebeccapurple; }</style></head>
  <body>
    <h1>Original heading</h1>
    <p id="keep">Untouched paragraph</p>
  </body>
</html>`;

const FILES = [{ id: "f1", path: "index.html", content: INDEX_HTML, language: "html" }];

type Put = { path: string; content: string };

async function mockBackend(
  page: import("@playwright/test").Page,
  puts: Put[],
  failFileList = false,
) {
  await page.route("**/api/devhub/**", async (route) => {
    const req = route.request();
    const url = req.url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/file") && req.method() === "PUT") {
      const body = JSON.parse(req.postData() || "{}");
      puts.push({ path: new URL(url).searchParams.get("path") || "", content: String(body.content ?? "") });
      return json({ file: { id: "f1", path: "index.html", content: body.content, language: "html" } });
    }
    if (url.includes(`/projects/${PROJECT_ID}/files`)) {
      // A refresh that fails the way this backend fails: JSON with an error and
      // no `files`. Used by the last test in this file.
      if (failFileList) return json({ error: "nope" }, 500);
      return json({ files: FILES });
    }
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: {
          id: PROJECT_ID, name: "visual", description: "", stack: "static",
          deployUrl: null, userId: "anonymous", collaborators: [],
        },
        files: FILES,
      });
    }
    if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
    if (url.includes("/deployments")) return json({ deployments: [] });
    return json({ ok: true });
  });
}

/**
 * Select elements one at a time until the heading answers.
 *
 * Blasting a select for every vid at once — the shortcut the preview specs use
 * to prove the overlay is alive — leaves the IDE holding whichever element
 * answered last, so the edit lands somewhere else. That is not a product bug,
 * it is what asking for eleven selections in a row means.
 */
async function selectHeading(page: import("@playwright/test").Page) {
  for (let vid = 0; vid <= 10; vid++) {
    const answer = await page.evaluate(
      (v) =>
        new Promise<{ vid: string; tagName: string; text: string } | null>((resolve) => {
          const frame = document.querySelector("iframe[sandbox]") as HTMLIFrameElement | null;
          if (!frame) return resolve(null);
          const onMsg = (e: MessageEvent) => {
            if (e.data?.source === "devhub-visual-edit") {
              window.removeEventListener("message", onMsg);
              resolve({ vid: String(e.data.vid), tagName: String(e.data.tagName || ""), text: String(e.data.text || "") });
            }
          };
          window.addEventListener("message", onMsg);
          frame.contentWindow?.postMessage({ source: "devhub-visual-edit-select", vid: String(v) }, "*");
          setTimeout(() => { window.removeEventListener("message", onMsg); resolve(null); }, 1500);
        }),
      vid,
    );
    if (answer && answer.tagName.toUpperCase() === "H1") return answer;
  }
  return null;
}

test.describe("DevHub — Visual Edit writes the source, not the rendering", () => {
  test("editing a heading saves that change and leaves the rest of the file alone", async ({ page }) => {
    test.setTimeout(120_000);
    const puts: Put[] = [];
    await mockBackend(page, puts);

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: /Visual Edit/ }).click({ timeout: 30_000 });
    await expect(page.locator("iframe[sandbox]")).toBeVisible({ timeout: 20_000 });

    const selected = await selectHeading(page);
    expect(selected, "the overlay never answered — the postMessage bridge is the feature").not.toBeNull();
    expect(selected!.text).toContain("Original heading");

    const textField = page.locator('textarea, input[type="text"]').filter({ hasText: "" }).first();
    await expect(textField).toBeVisible({ timeout: 10_000 });
    await textField.fill("Edited heading");
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect.poll(() => puts.length, { timeout: 15_000 }).toBeGreaterThan(0);
    const saved = puts[puts.length - 1];
    expect(saved.path).toBe("index.html");
    expect(saved.content).toContain("Edited heading");
    // The rest of the document must survive: the save writes the pristine
    // source, so neither the untouched paragraph nor the stylesheet may go.
    expect(saved.content).toContain("Untouched paragraph");
    expect(saved.content).toContain("rebeccapurple");
    // And the editing scaffolding must never reach the file.
    expect(saved.content).not.toContain("data-vid");
  });

  test("a file list that fails to refresh leaves the tree alone instead of emptying it", async ({ page }) => {
    // Saving a visual edit re-reads the file list afterwards. Twelve places in
    // the IDE did that with `setFiles(listData.files || [])`, and this backend
    // answers a failure with JSON carrying an error and no files — so the tree
    // was handed an empty array and the project looked wiped by an operation
    // that had merely failed to re-read it.
    test.setTimeout(120_000);
    const puts: Put[] = [];
    await mockBackend(page, puts, true);

    await page.goto(`/devhub/${PROJECT_ID}`);
    const treeEntry = page.getByText("index.html", { exact: false }).first();
    await expect(treeEntry, "the project loaded with its file").toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: /Visual Edit/ }).click({ timeout: 30_000 });
    await expect(page.locator("iframe[sandbox]")).toBeVisible({ timeout: 20_000 });
    const selected = await selectHeading(page);
    expect(selected, "the overlay never answered").not.toBeNull();

    const textField = page.locator('textarea, input[type="text"]').filter({ hasText: "" }).first();
    await expect(textField).toBeVisible({ timeout: 10_000 });
    await textField.fill("Edited heading");
    await page.getByRole("button", { name: /^Save$/ }).click();

    // Checked first and on purpose: this warning exists only on the guarded
    // path, so it proves the refresh was reached and did fail. Three earlier
    // attempts at this test failed right here — not because the guard was
    // missing, but because a single-slot toast let the following "Saved"
    // overwrite the warning before anything could see it. That is fixed; if
    // this line ever fails again, suspect the same thing.
    await expect(
      page.getByText(/Не удалось обновить список файлов/),
      "the refresh was never reached, so this test proves nothing",
    ).toBeVisible({ timeout: 20_000 });

    await expect(treeEntry, "the file tree was emptied by a failed refresh").toBeVisible();
  });
});
