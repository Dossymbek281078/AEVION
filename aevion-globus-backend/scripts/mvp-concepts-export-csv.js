#!/usr/bin/env node
/**
 * MVP concept items → CSV exporter for compliance / audit handoff.
 *
 * For each of the 10 ownerless modules (or a single --module=<id>), walks
 * /api/<id>/<noun> paginated and writes one CSV per module to a chosen
 * directory (default ./mvp-exports/<date>/). Each CSV has stable columns:
 *
 *   id, moduleId, createdAt, ownerId, title, summary, tags, payload_json
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/mvp-concepts-export-csv.js
 *   BASE=https://aevion-production-a70c.up.railway.app \
 *     node scripts/mvp-concepts-export-csv.js
 *   node scripts/mvp-concepts-export-csv.js --module=startup-exchange
 *   node scripts/mvp-concepts-export-csv.js --out=./tmp-export
 */

const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");
const PAGE = 200;

function arg(name, dflt) {
  const m = process.argv.find((a) => a.startsWith(name + "="));
  return m ? m.slice(name.length + 1) : dflt;
}

const TARGET = arg("--module", "");
const OUT_BASE = arg("--out", path.join(process.cwd(), "mvp-exports", new Date().toISOString().slice(0, 10)));

const MODULES = [
  { id: "startup-exchange", noun: "listings"   },
  { id: "mapreality",       noun: "claims"     },
  { id: "kids-ai-content",  noun: "items"      },
  { id: "qlife",            noun: "prompts"    },
  { id: "psyapp-deps",      noun: "assessments"},
  { id: "qpersona",         noun: "personas"   },
  { id: "voice-of-earth",   noun: "feeds"      },
  { id: "deepsan",          noun: "runs"       },
  { id: "shadownet",        noun: "posts"      },
  { id: "lifebox",          noun: "capsules"   },
];

const COLUMNS = ["id", "moduleId", "createdAt", "ownerId", "title", "summary", "tags", "payload_json"];

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToFields(row) {
  return [
    row.id,
    row.moduleId,
    row.createdAt,
    row.ownerId ?? "",
    row.title ?? "",
    row.summary ?? "",
    Array.isArray(row.tags) ? row.tags.join("|") : "",
    JSON.stringify(row.payload ?? {}),
  ];
}

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  if (r.status !== 200) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function exportModule(m) {
  fs.mkdirSync(OUT_BASE, { recursive: true });
  const file = path.join(OUT_BASE, `${m.id}.csv`);
  const stream = fs.createWriteStream(file);
  stream.write(COLUMNS.join(",") + "\n");

  let offset = 0;
  let total = 0;
  for (;;) {
    const body = await getJson(`/api/${m.id}/${m.noun}?limit=${PAGE}&offset=${offset}`);
    const rows = Array.isArray(body?.items) ? body.items : [];
    if (rows.length === 0) break;
    rows.sort((a, b) => Number(a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    for (const row of rows) stream.write(rowToFields(row).map(csvEscape).join(",") + "\n");
    total += rows.length;
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  stream.end();
  await new Promise((resolve, reject) => { stream.on("finish", resolve); stream.on("error", reject); });
  console.log(`✓ ${m.id}.csv — ${total} rows`);
  return total;
}

async function main() {
  console.log(`MVP concept CSV exporter → ${BASE}`);
  console.log(`Output: ${OUT_BASE}\n`);
  const targets = TARGET ? MODULES.filter((m) => m.id === TARGET) : MODULES;
  if (targets.length === 0) {
    console.error(`Unknown --module=${TARGET}`);
    process.exit(2);
  }
  let grand = 0;
  for (const m of targets) {
    try { grand += await exportModule(m); }
    catch (e) { console.error(`✗ ${m.id}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`\nTotal exported: ${grand} rows across ${targets.length} module(s).`);
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
