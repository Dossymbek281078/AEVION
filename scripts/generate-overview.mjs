#!/usr/bin/env node
/**
 * Generate docs/AEVION_OVERVIEW.md from live /api/aevion catalog + stats.
 *
 * Re-runnable single source of truth for the AEVION ecosystem snapshot.
 * Used for investor decks, partner intros, and onboarding new sessions.
 *
 * Usage:
 *   node scripts/generate-overview.mjs                                     # against prod
 *   BASE=https://api.aevion.app node scripts/generate-overview.mjs         # explicit
 *   BASE=http://127.0.0.1:4001 node scripts/generate-overview.mjs          # local
 */

import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_PATH = resolve(REPO_ROOT, "docs/AEVION_OVERVIEW.md");

const BASE = (process.env.BASE || "https://api.aevion.app").replace(/\/+$/, "");
const SITE = (process.env.SITE || "https://aevion.app").replace(/\/+$/, "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const url = `${BASE}${path}`;
  // Exponential backoff between retries: 1s after attempt 1, 3s after attempt 2 (9s reserved if attempts grow).
  const backoffMs = [1000, 3000, 9000];
  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[generate-overview] attempt ${attempt}/${MAX_ATTEMPTS} → ${url}`);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      console.error(`[generate-overview] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e?.message || e}`);
      if (attempt < MAX_ATTEMPTS) {
        const wait = backoffMs[attempt - 1];
        console.log(`[generate-overview] retrying in ${wait}ms...`);
        await sleep(wait);
      }
    }
  }
  console.error(`[generate-overview] FATAL: all ${MAX_ATTEMPTS} attempts failed for ${url}`);
  throw lastErr;
}

function pct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

async function main() {
  console.log(`[generate-overview] Source: ${BASE}`);
  const [catalog, stats] = await Promise.all([
    fetchJson("/api/aevion/catalog"),
    fetchJson("/api/aevion/registry-stats"),
  ]);

  const byStatus = stats.byStatus || {};
  const byKind = stats.byKind || {};
  const byTag = stats.byTag || [];
  const items = catalog.items || [];
  const itemsByStatus = new Map();
  for (const it of items) {
    const s = String(it.status || "unknown");
    if (!itemsByStatus.has(s)) itemsByStatus.set(s, []);
    itemsByStatus.get(s).push(it);
  }

  const STATUS_ORDER = ["launched", "mvp", "working", "in_progress", "research", "planning", "idea"];
  const orderedStatuses = [
    ...STATUS_ORDER.filter((s) => itemsByStatus.has(s)),
    ...Array.from(itemsByStatus.keys()).filter((s) => !STATUS_ORDER.includes(s)),
  ];

  const STATUS_EMOJI = {
    launched: "🟢", mvp: "🟢", working: "🟢",
    in_progress: "🟡", research: "🟣", planning: "🔵", idea: "⚪",
  };

  const lines = [];

  lines.push(`# AEVION Ecosystem Overview`);
  lines.push("");
  lines.push(`> **Auto-generated** from \`${BASE}/api/aevion/catalog\` + \`/registry-stats\`.`);
  lines.push(`> Snapshot taken: ${new Date().toISOString()}`);
  lines.push(`> Re-generate: \`node scripts/generate-overview.mjs\``);
  lines.push("");

  // Top-level summary
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- **Total modules:** ${stats.total}`);
  const statusSummary = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${STATUS_EMOJI[k] || "⚪"} ${k}: **${v}** (${pct(v, stats.total)})`)
    .join(" · ");
  lines.push(`- **By status:** ${statusSummary}`);
  const kindSummary = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: **${v}**`)
    .join(" · ");
  lines.push(`- **By kind:** ${kindSummary}`);
  lines.push("");

  // Tag cloud
  lines.push(`## Top tags`);
  lines.push("");
  lines.push(
    byTag
      .slice(0, 20)
      .map((t) => `\`${t.tag}\` (${t.count})`)
      .join(" · "),
  );
  lines.push("");

  // TOC
  lines.push(`## Contents`);
  lines.push("");
  for (const s of orderedStatuses) {
    const cnt = itemsByStatus.get(s)?.length || 0;
    lines.push(`- [${STATUS_EMOJI[s] || "⚪"} ${s} (${cnt})](#${s.replace(/_/g, "-")})`);
  }
  lines.push("");

  // Per-status sections
  for (const status of orderedStatuses) {
    const mods = itemsByStatus.get(status) || [];
    if (!mods.length) continue;
    lines.push(`## ${status}`);
    lines.push("");
    lines.push(`${STATUS_EMOJI[status] || "⚪"} **${mods.length} modules**`);
    lines.push("");
    lines.push(`| Code | Name | Kind | Tags | Links |`);
    lines.push(`|------|------|------|------|-------|`);
    for (const m of mods.sort((a, b) => (a.priority || 99) - (b.priority || 99))) {
      const tags = Array.isArray(m.tags) ? m.tags.join(", ") : "";
      const links = [
        `[page](${m.frontend})`,
        m.openapi ? `[api](${m.openapi})` : null,
        m.status_url ? `[status](${m.status_url})` : null,
      ].filter(Boolean).join(" · ");
      lines.push(
        `| \`${m.code || m.id}\` | ${m.name.replace(/\|/g, "\\|")} | ${m.kind} | ${tags} | ${links} |`,
      );
    }
    lines.push("");
  }

  // Hub API quick reference
  lines.push(`## Hub API quick reference`);
  lines.push("");
  lines.push("```");
  lines.push(`GET ${BASE}/api/aevion/health             # aggregate health across all modules`);
  lines.push(`GET ${BASE}/api/aevion/catalog            # full catalog (JSON)`);
  lines.push(`    ?status=mvp,working                  # filter`);
  lines.push(`    ?tag=ai,fintech                       # filter`);
  lines.push(`    ?kind=product                         # filter`);
  lines.push(`    ?fields=id,name,frontend              # projection (~10× smaller)`);
  lines.push(`    ?format=csv                           # RFC 4180`);
  lines.push(`    ?format=md                            # GitHub table`);
  lines.push(`GET ${BASE}/api/aevion/catalog/:id        # single-module deep lookup`);
  lines.push(`GET ${BASE}/api/aevion/registry-stats     # taxonomy summary`);
  lines.push(`GET ${BASE}/api/aevion/badges/:id.svg     # shields.io-style status badge`);
  lines.push(`GET ${BASE}/api/aevion/openapi.json       # OpenAPI spec index`);
  lines.push(`GET ${BASE}/api/aevion/sitemap.xml        # platform sitemap`);
  lines.push(`GET ${BASE}/api/aevion/version            # build info`);
  lines.push("```");
  lines.push("");

  const content = lines.join("\n") + "\n";
  await writeFile(OUT_PATH, content, "utf8");
  console.log(`[generate-overview] Wrote ${OUT_PATH} (${content.length} bytes)`);
  console.log(`[generate-overview] Modules: ${stats.total} · Statuses: ${orderedStatuses.join(", ")}`);
}

main().catch((e) => {
  console.error("[generate-overview] FATAL:", e?.stack || e);
  process.exit(1);
});
