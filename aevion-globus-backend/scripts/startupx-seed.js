#!/usr/bin/env node
/**
 * Publish the first real listings on the exchange from a prepared file.
 *
 * Dry-run by default: prints exactly what would be sent and what the free
 * analysis says about it, and writes nothing. Publishing takes --publish, and
 * publishing is a decision about price and positioning, so it belongs to a
 * human who typed that flag on purpose.
 *
 *   node scripts/startupx-seed.js                  # показать, что уйдёт
 *   node scripts/startupx-seed.js --publish        # опубликовать
 *   BASE=https://aevion.vercel.app/api-backend node scripts/startupx-seed.js --publish
 *
 * The manage links are printed once and never again — the server keeps only a
 * hash of each token. Save the output.
 */

const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const FILE = process.env.SEED_FILE || path.join(__dirname, "..", "..", "docs", "startupx-seed-listings.json");
const PUBLISH = process.argv.includes("--publish");

async function post(pathname, body) {
  const r = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  try {
    return { status: r.status, body: JSON.parse(text) };
  } catch {
    return { status: r.status, body: text };
  }
}

/** Strip the "_field" hints and the placeholder intent used in the template. */
function cleanDeal(deal) {
  const out = {};
  for (const [k, v] of Object.entries(deal ?? {})) {
    if (k.startsWith("_")) continue;
    if (typeof v === "string" && v.startsWith("ЗАПОЛНИТЬ")) continue;
    if (v === "" || v === null) continue;
    out[k] = v;
  }
  return out;
}

async function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`Файл не найден: ${FILE}`);
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const listings = Array.isArray(doc.listings) ? doc.listings : [];
  console.log(`\nЗаявок в файле: ${listings.length} → ${BASE}${PUBLISH ? "  [ПУБЛИКАЦИЯ]" : "  [сухой прогон]"}\n`);

  let ready = 0;
  let blocked = 0;

  for (const raw of listings) {
    const listing = { ...raw, deal: cleanDeal(raw.deal) };
    delete listing._readme;
    console.log(`── ${listing.title}`);

    // The free analysis runs without deal terms, so a half-filled template
    // still shows the founder what an investor would see.
    const preview = await post("/api/startupx/assess", listing);
    const a = preview.body?.data?.assessment;
    if (a) {
      console.log(`   разбор: ${a.score}/100 (${a.band}) · отрасль ${a.sector.label} [${a.sector.origin}]`);
      for (const f of a.redFlags.filter((x) => x.severity === "high")) console.log(`   ⚠ ${f.message}`);
    } else {
      console.log(`   разбор недоступен: ${preview.status} ${JSON.stringify(preview.body).slice(0, 120)}`);
    }

    if (!listing.deal.intent) {
      console.log("   ✗ не заполнены условия сделки — публиковать нечего\n");
      blocked++;
      continue;
    }
    ready++;

    if (!PUBLISH) {
      console.log("   (сухой прогон — ничего не отправлено)\n");
      continue;
    }

    const created = await post("/api/startupx/ideas", listing);
    if (created.status !== 201) {
      // Код важен: 429 без него не отличить «подождите минуту» от «суточный
      // потолок исчерпан, продолжите завтра» (`daily_publish_limit`).
      console.log(`   ✗ не опубликовано: ${created.status}${created.body?.error ? " " + created.body.error : ""}`);
      for (const i of created.body?.issues ?? []) console.log(`     — ${i.field}: ${i.message}`);
      console.log("");
      continue;
    }
    const d = created.body.data;
    console.log(`   ✓ заявка №${d.id}`);
    console.log(`   СОХРАНИТЕ ССЫЛКУ (показывается один раз):`);
    console.log(`   /startup-exchange/${d.id}/offers?token=${d.manageToken}\n`);
  }

  console.log(`Готовых к публикации: ${ready}, без условий сделки: ${blocked}`);
  if (!PUBLISH && ready > 0) console.log("Публикация: добавьте --publish");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
