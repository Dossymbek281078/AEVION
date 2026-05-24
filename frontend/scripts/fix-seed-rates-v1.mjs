#!/usr/bin/env node
/**
 * fix-seed-rates-v1 — однократная миграция учебного корпуса seed.json:
 *  (а) поднять basePrice труда до ставок РК 2026 по таблице разрядов
 *  (б) заменить «Перфоратор электрический» → «Отбойный молоток электрический»
 *      в ДЕМ-позициях штукатурки/плитки/стяжки/потолков
 *  (в) пересчитать baseCostPerUnit, сохранив исходный НР/СП-ratio
 *
 * Запуск: node scripts/fix-seed-rates-v1.mjs (из frontend/)
 *
 * Шифры (62% псевдо-префиксов — ДЕМ-, ОТД-, ФАС- и т.д.) НЕ трогаются —
 * это отдельная миграция с маппингом по СНБ РК.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, "../src/app/smeta-trainer/data/seed.json");

const RANK_TARIFF_2026 = { 2: 950, 3: 1100, 4: 1300, 5: 1500, 6: 1800 };
const STUCCO_RE = /штукатур|плитк|стяжк|потолок|потолков|потолч|перегород/i;

const data = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
const before = JSON.parse(JSON.stringify(data));

const detectRank = (name) => {
  const m = /(\d)\s*разряд/i.exec(name ?? "");
  return m ? Number(m[1]) : null;
};
const sumResources = (rs) =>
  (rs ?? []).reduce((s, r) => s + (r.qtyPerUnit ?? 0) * (r.basePrice ?? 0), 0);

let touchedRates = 0;
let touchedLabor = 0;
let toolReplacements = 0;
const rankStats = {};

for (const rate of data.rates ?? []) {
  let rateTouched = false;
  const oldSum = sumResources(rate.resources);
  const oldBase = rate.baseCostPerUnit ?? 0;

  for (const res of rate.resources ?? []) {
    if (res.kind === "труд") {
      const rank = detectRank(res.name);
      if (rank != null && rank in RANK_TARIFF_2026) {
        const newPrice = RANK_TARIFF_2026[rank];
        if (res.basePrice !== newPrice) {
          res.basePrice = newPrice;
          touchedLabor++;
          rateTouched = true;
          rankStats[rank] = (rankStats[rank] ?? 0) + 1;
        }
      }
    }
  }

  if (rate.category === "демонтажные" && STUCCO_RE.test(rate.title ?? "")) {
    for (const res of rate.resources ?? []) {
      if (res.kind === "машины" && res.name === "Перфоратор электрический") {
        res.name = "Отбойный молоток электрический";
        toolReplacements++;
        rateTouched = true;
      }
    }
  }

  if (rateTouched) {
    const newSum = sumResources(rate.resources);
    const ratio = oldSum > 0 ? oldBase / oldSum : 1;
    rate.baseCostPerUnit = Math.round(newSum * ratio);
    touchedRates++;
  }
}

data._meta = data._meta ?? {};
data._meta.version = "0.5.0";
data._meta.lastReview = new Date().toISOString().slice(0, 10);
data._meta.changelog = data._meta.changelog ?? [];
data._meta.changelog.unshift({
  version: "0.5.0",
  date: data._meta.lastReview,
  notes:
    "Ставки труда подняты до уровня РК 2026 (2р=950, 3р=1100, 4р=1300, 5р=1500, 6р=1800 ₸/чел.-ч); " +
    "baseCostPerUnit пересчитан с сохранением исходного НР/СП-ratio; " +
    "перфоратор → отбойный молоток в ДЕМ-позициях штукатурки/плитки/стяжки/потолков. " +
    "Шифры не трогали — отдельная миграция.",
});

fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");

let printed = 0;
for (let i = 0; i < data.rates.length && printed < 5; i++) {
  const oldR = before.rates[i];
  const newR = data.rates[i];
  if (JSON.stringify(oldR) === JSON.stringify(newR)) continue;
  printed++;
  console.log(`\n=== [${printed}] ${newR.code} — ${newR.title} ===`);
  console.log(`baseCostPerUnit: ${oldR.baseCostPerUnit} → ${newR.baseCostPerUnit} (${oldR.unit})`);
  for (let j = 0; j < newR.resources.length; j++) {
    const o = oldR.resources[j];
    const n = newR.resources[j];
    if (!o || !n) continue;
    if (o.basePrice !== n.basePrice || o.name !== n.name) {
      console.log(
        `  · ${n.kind}: «${o.name}» ${o.basePrice} → «${n.name}» ${n.basePrice}` +
          (o.name !== n.name ? "   ⚠ заменён инструмент" : "")
      );
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Rates updated:        ${touchedRates} / ${data.rates.length}`);
console.log(`Labor rows updated:   ${touchedLabor}`);
console.log(`  by rank:            ${JSON.stringify(rankStats)}`);
console.log(`Tool replacements:    ${toolReplacements}`);
