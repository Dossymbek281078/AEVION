import { test, expect } from "@playwright/test";

/**
 * The flagship flow, exactly as the founder uses it: open /devhub, type an
 * idea into the hero box, hit Build, and end up in the IDE with real files
 * (NOT an output.ts dump) and a live React preview that actually renders.
 *
 * Runs ONLY when FOUNDER_FLOW_PROD=1 — it fires a real AI generation against
 * the target deployment (costs a generation, takes minutes), so it belongs to
 * the nightly prod check, not the per-push suite.
 */
const ENABLED = process.env.FOUNDER_FLOW_PROD === "1";

test.describe("founder flow: describe → built app", () => {
  test.skip(!ENABLED, "set FOUNDER_FLOW_PROD=1 to run against a live deployment");
  test.setTimeout(360_000);

  test("hero idea produces real files and a rendering live preview", async ({ page }) => {
    await page.goto("/devhub");

    // Hero prompt box (placeholder survives AutoTranslate poorly — match loosely).
    const hero = page.locator("textarea").filter({ hasNot: page.locator("[data-x]") }).first();
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await hero.fill("таймер помодоро с настройкой длительности");
    await page.getByRole("button", { name: /Построить|⚡/ }).click();

    // Landed in the IDE with auto-generation running.
    await page.waitForURL(/\/devhub\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const projectId = page.url().match(/\/devhub\/([0-9a-f-]{36})/)![1];

    // Wait for generation to finish: poll the files API (UI text is subject
    // to AutoTranslate, file paths are not).
    await expect
      .poll(
        async () => {
          const r = await page.request.get(`/api-backend/api/devhub/projects/${projectId}/files`);
          const d = await r.json();
          return (d.files ?? []).map((f: { path: string }) => f.path);
        },
        { timeout: 300_000, intervals: [10_000] }
      )
      .not.toEqual([]);

    const filesResp = await page.request.get(`/api-backend/api/devhub/projects/${projectId}/files`);
    const paths: string[] = ((await filesResp.json()).files ?? []).map((f: { path: string }) => f.path);

    // The founder's broken first impression: everything dumped into output.ts.
    expect(paths).not.toEqual(["output.ts"]);
    expect(paths.some((p) => /\.(jsx|tsx)$/.test(p))).toBe(true);

    // Live preview renders: open Visual Edit and ask the overlay for element 0.
    await page.getByRole("button", { name: /Visual Edit/ }).click();
    const iframe = page.locator('iframe[sandbox="allow-scripts"]');
    await expect(iframe).toBeVisible({ timeout: 30_000 });

    const rendered = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const frame = document.querySelector('iframe[sandbox]') as HTMLIFrameElement | null;
          if (!frame) return resolve(false);
          const onMsg = (e: MessageEvent) => {
            if (e.data && e.data.source === "devhub-visual-edit") {
              window.removeEventListener("message", onMsg);
              resolve(true);
            }
          };
          window.addEventListener("message", onMsg);
          const probe = () => {
            for (let v = 0; v <= 5; v++) {
              frame.contentWindow?.postMessage({ source: "devhub-visual-edit-select", vid: String(v) }, "*");
            }
          };
          // React + esm.sh need a moment; retry the probe a few times.
          let tries = 0;
          const timer = setInterval(() => {
            probe();
            if (++tries >= 10) {
              clearInterval(timer);
              setTimeout(() => resolve(false), 4_000);
            }
          }, 3_000);
        })
    );
    expect(rendered).toBe(true);
  });
});
