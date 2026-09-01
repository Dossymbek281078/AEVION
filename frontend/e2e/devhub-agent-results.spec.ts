import { test, expect } from "@playwright/test";

/**
 * Each step of an agent workflow must show its OWN verdict.
 *
 * The panel rendered `agentResults[i]` — the result at that position in the
 * array — while results arrive as they complete and carry the step number they
 * belong to. The stream reader also tolerates an unparseable event on purpose,
 * so a single swallowed event shifted every later result up a row and each step
 * displayed its neighbour's outcome. A failure attributed to the wrong step is
 * worse than no verdict at all: it sends someone to fix a step that worked.
 *
 * The check needs no knowledge of which row is which. Results are streamed out
 * of order with a label naming the step they belong to, so with position-based
 * indexing the labels come out shuffled and with the fix they come out in step
 * order.
 */

const PROJECT_ID = "11111111-2222-3333-4444-555555555555";
const FILES = [{ id: "f1", path: "index.html", content: "<h1>hi</h1>", language: "html" }];

/** Server-sent events for a three-step run, answered out of completion order. */
const STREAM = [
  { type: "step-start", index: 0 },
  // Step 3 finishes first — the ordering the array-position lookup got wrong.
  { type: "step-done", index: 2, ok: true, savedAs: "for-step-3" },
  { type: "step-done", index: 0, ok: true, savedAs: "for-step-1" },
  { type: "step-done", index: 1, ok: true, savedAs: "for-step-2" },
  { type: "complete", totalSteps: 3, successCount: 3, failureCount: 0 },
]
  .map((e) => `data: ${JSON.stringify(e)}\n\n`)
  .join("");

/** A run that stops after two steps and never sends "complete". */
const TRUNCATED_STREAM = [
  { type: "step-start", index: 0 },
  { type: "step-done", index: 0, ok: true, savedAs: "for-step-1" },
  { type: "step-done", index: 1, ok: true, savedAs: "for-step-2" },
]
  .map((e) => `data: ${JSON.stringify(e)}\n\n`)
  .join("");

async function mockBackend(page: import("@playwright/test").Page, stream = STREAM) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/agent/workflow/stream")) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: stream });
    }
    if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: {
          id: PROJECT_ID, name: "agent-e2e", description: "", stack: "react",
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

test("each agent step shows its own result, not its neighbour's", async ({ page }) => {
  test.setTimeout(120_000);
  await mockBackend(page);
  await page.goto(`/devhub/${PROJECT_ID}`);

  await page.getByRole("tab", { name: /Agent/ }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: /Run \d+-step Workflow/ }).click({ timeout: 20_000 });

  // Verdicts render inside their step's row, so their order in the document is
  // the order of the steps. Three labels must appear, and in step order.
  const verdicts = page.getByText(/for-step-\d/);
  await expect(verdicts).toHaveCount(3, { timeout: 30_000 });
  expect(
    (await verdicts.allInnerTexts()).map((t) => t.trim()),
    "results were pinned to array position instead of to their step number",
  ).toEqual(["✓ for-step-1", "✓ for-step-2", "✓ for-step-3"]);
});

test("a run that stops half way says so instead of ending in silence", async ({ page }) => {
  // The server ends a finished run with a "complete" event. A stream that
  // simply stopped — process died, connection dropped, proxy timed out — left
  // the panel with no summary and no error: the button went back to normal and
  // the steps that never reported looked identical to steps never run.
  test.setTimeout(120_000);
  await mockBackend(page, TRUNCATED_STREAM);
  await page.goto(`/devhub/${PROJECT_ID}`);

  await page.getByRole("tab", { name: /Agent/ }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: /Run \d+-step Workflow/ }).click({ timeout: 20_000 });

  await expect(
    page.getByText(/Прогон оборвался/),
    "a truncated run reported nothing at all",
  ).toBeVisible({ timeout: 30_000 });
  // And it must say how much of the run actually reported.
  await expect(page.getByText(/отчитались 2 из 3/)).toBeVisible();
});
