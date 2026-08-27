import { test, expect } from "@playwright/test";

/**
 * Deploy is the money path — "your code, a live page" — so the address it
 * names has to be the one that answers.
 *
 * The server already decides that: it hands back liveUrl, falling back to the
 * pages.dev address when the custom domain does not resolve. The IDE announced
 * the domain the moment it merely existed, which is how someone was told their
 * page was live at an address failing DNS.
 */

const PROJECT_ID = "31313131-4242-5353-6464-757575757575";
const FILES = [{ id: "f1", path: "index.html", content: "<h1>hi</h1>", language: "html" }];

async function mockDeploy(page: import("@playwright/test").Page, deploy: Record<string, unknown>) {
  await page.route("**/api/devhub/**", async (route) => {
    const url = route.request().url();
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/deploy/pages")) return json({ ok: true, ...deploy });
    if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
    if (url.includes(`/projects/${PROJECT_ID}`)) {
      return json({
        project: { id: PROJECT_ID, name: "dep", description: "", stack: "static", deployUrl: null, userId: "anonymous", collaborators: [] },
        files: FILES,
      });
    }
    if (url.includes("/studio/capabilities")) return json({ capabilities: [{ id: "pages", name: "Cloudflare Pages", status: "live" }] });
    if (url.includes("/deployments")) return json({ deployments: [] });
    return json({ ok: true });
  });
}

test.describe("DevHub — a deploy names the address that answers", () => {
  test("an unresolved custom domain is not announced as live", async ({ page }) => {
    await mockDeploy(page, {
      pagesUrl: "https://abc.aevion-dep.pages.dev",
      domain: "dep-123.aevion.build",
      domainUrl: "https://dep-123.aevion.build",
      domainReady: false,
      liveUrl: "https://abc.aevion-dep.pages.dev",
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "Deployments", exact: true }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /Deploy to Cloudflare Pages/ }).click();

    await expect(page.getByText(/Live: https:\/\/abc\.aevion-dep\.pages\.dev/)).toBeVisible({ timeout: 15_000 });
    // The domain may be mentioned — but as the thing that does not answer yet,
    // never as the live address.
    await expect(page.getByText(/Live: https:\/\/dep-123\.aevion\.build/)).toHaveCount(0);
    await expect(page.getByText(/не отвечает/)).toBeVisible({ timeout: 15_000 });
  });

  test("a resolving domain is announced, because then it is true", async ({ page }) => {
    await mockDeploy(page, {
      pagesUrl: "https://abc.aevion-dep.pages.dev",
      domain: "dep-123.aevion.build",
      domainUrl: "https://dep-123.aevion.build",
      domainReady: true,
      liveUrl: "https://dep-123.aevion.build",
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: "Deployments", exact: true }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /Deploy to Cloudflare Pages/ }).click();

    await expect(page.getByText(/Live: https:\/\/dep-123\.aevion\.build/)).toBeVisible({ timeout: 15_000 });
  });
});
