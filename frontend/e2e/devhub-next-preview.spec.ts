import { test, expect } from "@playwright/test";

/**
 * DevHub — client-side live preview for a Next.js project (PR #920).
 *
 * Why this test exists: the preview contract (Babel in the parent → files as
 * data: URL modules → import map → next/* shims) is only unit-tested at the
 * string level. Whether the browser actually *renders* it was verified once
 * by hand, and nightly only ever exercises the React path — against a real AI
 * generation, so it cannot be run per-push.
 *
 * This one is deterministic and free: the backend is mocked, the page content
 * is fixed, and the assertion is the same one the founder-flow nightly makes —
 * the overlay inside the sandboxed iframe answers a select probe, which is
 * only possible if React mounted and rendered real DOM.
 *
 * External dependency: react/react-dom come from esm.sh (the preview has no
 * bundled React). A network block there fails this test — by design, since
 * that is also what a user would see.
 */

const PROJECT_ID = "11111111-2222-3333-4444-555555555555";

const PAGE_TSX = `"use client";
import Link from "next/link";
import Image from "next/image";
import { Inter } from "next/font/google";
import s from "./page.module.css";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <main className={inter.className}>
      <h1 className={s.title}>Next preview works</h1>
      <Image src="/logo.png" alt="logo" width={32} height={32} />
      <Link href="/about">About</Link>
    </main>
  );
}`;

const PAGE_CSS = ".title { color: rebeccapurple; }";

const FILES = [
  { id: "f1", path: "app/page.tsx", content: PAGE_TSX, language: "typescript" },
  { id: "f2", path: "app/page.module.css", content: PAGE_CSS, language: "css" },
];

const RSC_FILES = [
  {
    id: "f1",
    path: "app/page.tsx",
    content: "export default async function Home() { const r = await fetch('/api'); return <p>{r}</p>; }",
    language: "typescript",
  },
];

test.describe("DevHub — Next.js live preview without a deploy", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        // GET /projects/:id returns the files alongside the project — the IDE
        // seeds its file list from here, not from a separate call.
        return json({
          project: {
            id: PROJECT_ID,
            name: "next-preview-e2e",
            description: "",
            stack: "next",
            // No deployUrl on purpose: the whole point is a preview *before*
            // any deploy exists, so the proxy fallback cannot mask a failure.
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
  });

  test("renders a page built from next/link, next/image, next/font and CSS Modules", async ({ page }) => {
    await page.goto(`/devhub/${PROJECT_ID}`);

    await page.getByRole("tab", { name: /Visual Edit/ }).click();

    const iframe = page.locator('iframe[sandbox="allow-scripts"]');
    await expect(iframe).toBeVisible({ timeout: 20_000 });

    // The import map must carry the shims — without them the module graph
    // cannot resolve "next/link" and the iframe would be blank.
    const srcdoc = (await iframe.getAttribute("srcdoc")) ?? "";
    expect(srcdoc).toContain('"next/link"');
    expect(srcdoc).toContain('"next/image"');
    expect(srcdoc).toContain('"devhub/css-module"');
    expect(srcdoc).toContain("rebeccapurple"); // CSS Module still injected as a real <style>
    expect(srcdoc).not.toContain("next/font"); // rewritten to a local stub

    // Same probe the founder-flow nightly uses: a reply proves React mounted
    // and the overlay tagged real DOM nodes.
    const rendered = await page.evaluate(
      () =>
        new Promise<{ text: string } | null>((resolve) => {
          const frame = document.querySelector('iframe[sandbox]') as HTMLIFrameElement | null;
          if (!frame) return resolve(null);
          const onMsg = (e: MessageEvent) => {
            if (e.data && e.data.source === "devhub-visual-edit") {
              window.removeEventListener("message", onMsg);
              resolve({ text: String(e.data.text || "") });
            }
          };
          window.addEventListener("message", onMsg);
          let tries = 0;
          const timer = setInterval(() => {
            for (let v = 0; v <= 8; v++) {
              frame.contentWindow?.postMessage({ source: "devhub-visual-edit-select", vid: String(v) }, "*");
            }
            if (++tries >= 8) {
              clearInterval(timer);
              setTimeout(() => resolve(null), 3_000);
            }
          }, 2_000);
        })
    );

    expect(rendered).not.toBeNull();
    expect(rendered!.text).toContain("Next preview works"); // the h1, through the CSS Module class
    expect(rendered!.text).toContain("About"); // the next/link shim rendered an <a>
  });

  test("refuses an async Server Component in words instead of a blank frame", async ({ page }) => {
    await page.route("**/api/devhub/**", async (route) => {
      const url = route.request().url();
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.includes(`/projects/${PROJECT_ID}/files`)) return json({ files: RSC_FILES });
      if (url.includes(`/projects/${PROJECT_ID}`)) {
        return json({
          project: { id: PROJECT_ID, name: "rsc", stack: "next", deployUrl: null, userId: "anonymous" },
          files: RSC_FILES,
        });
      }
      return json({ ok: true });
    });

    await page.goto(`/devhub/${PROJECT_ID}`);
    await page.getByRole("tab", { name: /Visual Edit/ }).click();

    await expect(page.getByText(/Server Component/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('iframe[sandbox="allow-scripts"]')).toHaveCount(0);
  });
});
