#!/usr/bin/env node
/**
 * Канарейка дрейфа цен: LemonSqueezy-вариант ↔ data/pricing.ts.
 *
 * ЗАЧЕМ. В шапке src/routes/checkout.ts заявлен инвариант: «Цена фиксируется в
 * продукте процессинга (LS variant / Gumroad product) — она ДОЛЖНА совпадать с
 * tier-ценой из data/pricing.ts». Держится этот инвариант только на честном
 * слове: поменяешь цену в коде — LS продолжит списывать старую, и никто не
 * узнает. Ровно этот класс («не падает, а тихо работает неправильно») уже дал
 * два бага в этой же зоне 2026-07-26: промо считалось двумя способами, а
 * скидки на LS/Gumroad вообще не доходили до счёта.
 *
 * ЧТО ДЕЛАЕТ. Тянет реальные цены вариантов из LS API и сверяет с TIERS.
 * Read-only: только GET, ничего не создаёт и не меняет.
 *
 * ЗАПУСК:
 *   LEMON_SQUEEZY_API_KEY=... node scripts/ls-variant-price-drift.js
 *
 * Без ключа/variant-id скрипт НЕ падает и НЕ делает вид, что всё сошлось:
 * печатает SKIP с причиной и выходит с кодом 0 (так же ведут себя остальные
 * env-gated скрипты в этом репо). Расхождение → код 1.
 *
 * Вариантов ждём по конвенции LEMON_SQUEEZY_VARIANT_{LITE,MEDIUM,FULL}_{MONTHLY,ANNUAL}
 * (см. src/data/lemonSqueezyVariants.ts).
 */

const path = require("node:path");
const fs = require("node:fs");

const LS_BASE = "https://api.lemonsqueezy.com/v1";
const API_KEY = (process.env.LEMON_SQUEEZY_API_KEY || "").trim();

/** Цены тарифов читаем из исходника, чтобы не тянуть сборку TS в скрипт. */
function tierPricesFromSource() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "data", "pricing.ts"), "utf8");
  const tiersSection = src.slice(src.indexOf("export const TIERS"), src.indexOf("export const MODULES_PRICING"));
  const out = {};
  const re = /id:\s*"(free|lite|medium|full|pro|enterprise)"[\s\S]*?priceMonthly:\s*([0-9.]+|null)/g;
  let m;
  while ((m = re.exec(tiersSection)) !== null) {
    out[m[1]] = m[2] === "null" ? null : Number(m[2]);
  }
  return out;
}

async function lsVariant(variantId) {
  const r = await fetch(`${LS_BASE}/variants/${variantId}`, {
    headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const j = await r.json();
  const a = j?.data?.attributes ?? {};
  // LS хранит цену в центах; для подписочных вариантов это price за период.
  return { priceCents: a.price, name: a.name, interval: a.interval, intervalCount: a.interval_count };
}

async function main() {
  const prices = tierPricesFromSource();
  console.log("Цены из data/pricing.ts:", JSON.stringify(prices));

  if (!API_KEY) {
    console.log("\nSKIP: LEMON_SQUEEZY_API_KEY не задан — сверить цены не с чем.");
    console.log("Это НЕ значит «расхождений нет»: значит проверка не выполнялась.");
    process.exit(0);
  }

  const targets = [];
  for (const tier of ["lite", "medium", "full"]) {
    for (const period of ["monthly", "annual"]) {
      const env = `LEMON_SQUEEZY_VARIANT_${tier.toUpperCase()}_${period.toUpperCase()}`;
      const variantId = (process.env[env] || "").trim();
      if (!variantId) {
        console.log(`  · ${env} не задан — вариант пропущен`);
        continue;
      }
      // Годовой вариант должен стоить 10 месяцев (annualTotal = monthly × 10).
      const expectedUsd = period === "annual" ? prices[tier] * 10 : prices[tier];
      targets.push({ tier, period, variantId, expectedUsd, env });
    }
  }

  if (targets.length === 0) {
    console.log("\nSKIP: ни один LEMON_SQUEEZY_VARIANT_* не задан — сверять нечего.");
    process.exit(0);
  }

  let drift = 0;
  for (const t of targets) {
    const v = await lsVariant(t.variantId);
    if (v.error) {
      console.error(`  ✗ ${t.tier}/${t.period} (variant ${t.variantId}): ${v.error}`);
      drift++;
      continue;
    }
    const expectedCents = Math.round(t.expectedUsd * 100);
    if (v.priceCents === expectedCents) {
      console.log(`  ✓ ${t.tier}/${t.period}: $${t.expectedUsd} == LS variant ${t.variantId}`);
    } else {
      console.error(
        `  ✗ ДРЕЙФ ${t.tier}/${t.period}: код обещает $${t.expectedUsd}, LS спишет $${(v.priceCents ?? 0) / 100}` +
          ` (variant ${t.variantId}, "${v.name}")`,
      );
      drift++;
    }
  }

  console.log(`\n${targets.length} вариантов проверено — расхождений: ${drift}`);
  if (drift > 0) {
    console.error("Правь либо цену в data/pricing.ts, либо вариант в LS-дашборде: списывает LS, а не код.");
  }
  process.exit(drift > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("crash:", e?.message ?? e);
  process.exit(2);
});
