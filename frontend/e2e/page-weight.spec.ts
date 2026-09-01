import { test, expect } from "@playwright/test";

/**
 * How much JavaScript a page must download before it can answer a tap.
 *
 * This counts the `<script src>` tags in the HTML the server actually sends —
 * not everything the page eventually pulls. That distinction is the whole
 * point: lazy chunks arrive after the first screen and cost the visitor
 * nothing, while these bytes stand between the page appearing and the page
 * working.
 *
 * This spec exists because that distinction was got wrong once and nearly moved
 * the production pipeline. A note from 28.07.2026 had webpack blocking on
 * 1018 KB against Turbopack's 5569 KB — a 5.5× gap that turned out to be one
 * bundler's blocking set compared against the other's entire download. Measured
 * the same way on 10.08.2026 they are within a few per cent (Turbopack 2494 KB
 * on the shelf, webpack 2693 KB). From here the number lives in a test, not in
 * a document.
 *
 * The budgets sit ~15 % above the measured value, so this catches a real
 * regression — another route's code folded into a shared chunk — rather than
 * nagging about a new component.
 */

/**
 * Measured 10.08.2026 on the production build, plus headroom.
 *
 * These halved the same day, when the eleven-language dictionary stopped being
 * compiled into every page (2485 -> 1254 KB on the home page). What remains is
 * mostly the English dictionary, which has to be there for the first render.
 */
const BUDGET_KB: Record<string, number> = {
  "/": 1500, // measured 1254 KB in 16 files
  "/devhub": 1500, // measured 1264 KB in 16 files
  "/compare": 1500, // measured 1237 KB in 16 files
  // The regression this catches — another route's code folded into a chunk
  // every page loads — lands wherever the bundler decides, not on the three
  // pages that happened to be measured first. These are the rest of the doors
  // into the platform.
  "/shop": 1500, // measured 1202 KB in 15 files
  "/pricing": 1600, // measured 1334 KB in 18 files
  "/explore": 1500, // measured 1227 KB in 16 files
  "/qright": 1600, // measured 1305 KB in 17 files
  "/build": 1600, // measured 1272 KB in 19 files
};

async function blockingScriptWeight(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
  path: string,
) {
  const html = await (await request.get(path)).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => s.startsWith("/"));
  const unique = [...new Set(srcs)];

  let bytes = 0;
  for (const src of unique) {
    const res = await request.get(new URL(src, baseURL).toString());
    bytes += (await res.body()).byteLength;
  }
  return { kb: Math.round(bytes / 1024), files: unique.length };
}

for (const [path, budgetKb] of Object.entries(BUDGET_KB)) {
  test(`${path} stays under its blocking-JavaScript budget`, async ({ request, baseURL }) => {
    test.setTimeout(120_000);
    const { kb, files } = await blockingScriptWeight(request, baseURL!, path);
    // Zero would mean the regex stopped matching, not that the page got light.
    expect(files, `${path} served no script tags — the measurement broke`).toBeGreaterThan(0);
    expect(
      kb,
      `${path} blocks on ${kb} KB in ${files} files, budget ${budgetKb} KB. ` +
        `A jump this size usually means another route's code was folded into a shared chunk.`,
    ).toBeLessThan(budgetKb);
  });
}
