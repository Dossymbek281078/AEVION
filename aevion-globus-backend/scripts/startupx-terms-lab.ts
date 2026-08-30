/**
 * Что даёт биржа по первым заявкам AEVION — до того, как в них проставлены цена
 * и доля.
 *
 * Основателю нужно решить одно: сколько просить и за какую долю. Скрипт не
 * решает за него — он показывает, что о его же проекте скажет движок биржи при
 * разных вводных, и делает это ТЕМ ЖЕ кодом, что и живая страница
 * (`assessListing` + `valuationBand`), а не отдельной прикидкой.
 *
 * Запуск: npx ts-node -T scripts/startupx-terms-lab.ts
 */

import fs from "node:fs";
import path from "node:path";
import { assessListing } from "../src/lib/startupx/assess";
import { valuationBand, fmt } from "../src/lib/startupx/valuation";
import { normalizeListing } from "../src/lib/startupx/model";

const FILE = path.join(__dirname, "..", "..", "docs", "startupx-seed-listings.json");
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
const listings: Array<Record<string, unknown>> = Array.isArray(doc.listings) ? doc.listings : [];

// Раскрытая годовая выручка, при которой считаем полосу. Ноль — «как в файле
// сейчас»: цифр нет, и цена идёт по стадии, а не по выручке.
const REVENUE_STEPS = [0, 6_000, 24_000, 120_000, 600_000];

for (const raw of listings) {
  // Условия сделки в шаблоне ещё не заполнены, поэтому разбор берём в режиме
  // черновика — так же, как это делает бесплатный `POST /assess`.
  const { listing, issues } = normalizeListing({ ...raw, deal: {} }, { requireDeal: false });
  if (!listing) {
    console.log(`\n=== ${String(raw.title)}\n  не разбирается: ${JSON.stringify(issues)}`);
    continue;
  }
  const a = assessListing(listing);
  console.log(`\n=== ${listing.title}`);
  console.log(`уровень ${listing.tier} · отрасль ${a.sector.label} [${a.sector.origin}] · балл ${a.score}/100 (${a.band})`);
  for (const f of a.factors) console.log(`   ${f.key.padEnd(12)} ${String(f.score).padStart(3)}  ${f.basis}`);
  for (const f of a.redFlags) console.log(`   ⚠ [${f.severity}] ${f.message}`);

  console.log("   раскрытая годовая выручка → полоса рынка:");
  for (const rev of REVENUE_STEPS) {
    const b = valuationBand({
      tier: listing.tier,
      score: a.score,
      annualRevenueUsd: rev > 0 ? rev : null,
      metrics: listing.metrics,
    });
    const label = rev > 0 ? `$${fmt(rev)}/год`.padEnd(12) : "не раскрыта".padEnd(12);
    console.log(`     ${label} $${fmt(b.low)} – $${fmt(b.base)} – $${fmt(b.high)}  [${b.method}]`);
  }
}
