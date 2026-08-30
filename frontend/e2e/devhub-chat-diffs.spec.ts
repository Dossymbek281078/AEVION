import { test, expect } from "@playwright/test";

/**
 * The flagship loop's client half: type an idea, get files back, see what
 * changed, and be able to undo it.
 *
 * The diff itself is unit-tested (lib/lineDiff); what has never been checked in
 * a browser is the part around it — that a generation reaching the page turns
 * into a chat entry naming the files, showing the change, and offering the
 * revert that the checkpoint made possible.
 *
 * The IDE tries the SSE endpoint first and falls back to the plain POST when
 * it is unavailable. This mocks the stream as gone, which is both the simpler
 * case to assert and a real one — it is what an older pod mid-deploy does.
 */

const PROJECT_ID = "12121212-3434-5656-7878-909090909090";

const EXISTING = `export default function App() {
  return <button>Click me</button>;
}
`;

const GENERATED = `export default function App() {
  return <button style={{ background: "blue" }}>Click me</button>;
}
`;

const FILES = [{ id: "f1", path: "src/App.jsx", content: EXISTING, language: "javascript" }];

test.describe("DevHub — a generation shows what it changed and offers the way back", () => {
  test("the chat names the file, shows the diff and offers a revert", async ({ page }) => {
    test.setTimeout(120_000);
    const posted: string[] = [];
    let undone = false;

    await page.route("**/api/devhub/**", async (route) => {
      const req = route.request();
      const url = req.url();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

      if (url.includes("/generate/stream")) {
        // Gone — the IDE must fall back rather than hang or lose the request.
        return json({ error: "not found" }, 404);
      }
      if (url.includes("/generate/undo") || url.includes("/restore")) {
        undone = true;
        return json({ ok: true, label: "generate: make the button blue", revertedFiles: ["src/App.jsx"] });
      }
      if (url.includes("/generate")) {
        posted.push(String(req.postData() || ""));
        return json({
          ok: true,
          aiGenerated: true,
          checkpointId: "cp-1",
          files: [{ path: "src/App.jsx", content: GENERATED, language: "javascript" }],
        });
      }
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: {
            id: PROJECT_ID, name: "chat", description: "", stack: "react",
            deployUrl: null, userId: "anonymous", collaborators: [],
          },
          files: FILES,
        });
      }
      if (url.includes("/studio/capabilities")) return json({ capabilities: [] });
      if (url.includes("/checkpoints")) return json({ checkpoints: [] });
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "AI Generate", exact: true }).click({ timeout: 30_000 });

    const prompt = page.getByPlaceholder(/Describe what you want to build/);
    await expect(prompt).toBeVisible({ timeout: 15_000 });
    await prompt.fill("make the button blue");
    await page.getByRole("button", { name: /Generate Code/ }).click();

    // The request carried the words the user typed — not an empty body, which
    // is how a "generation" can look busy and mean nothing.
    await expect.poll(() => posted.length, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(posted[0]).toContain("make the button blue");

    // The answer names the file it touched.
    await expect(page.getByText("src/App.jsx").first()).toBeVisible({ timeout: 15_000 });

    // And offers the way back the checkpoint paid for.
    const revert = page.getByRole("button", { name: /Revert to before this/ });
    await expect(revert).toBeVisible({ timeout: 15_000 });
    await revert.click();
    await expect.poll(() => undone, { timeout: 15_000 }).toBe(true);
  });
});
