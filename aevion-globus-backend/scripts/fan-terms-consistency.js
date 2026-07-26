#!/usr/bin/env node
/**
 * Канарейка: условия веерной скидки на сайте == константы в коде.
 *
 * ЗАЧЕМ. `/pricing/refund-policy#fan` — это публичная оферта: там написано
 * «прямой контур до −45%», «окно 14 дней», «вместе с промокодом не более 50%».
 * Числа живут в `src/data/fanDiscounts.ts`. Если кто-то поменяет константу и не
 * тронет текст, сайт начнёт обещать то, чего движок не делает — а это спор с
 * платящим клиентом, который мы проиграем. Именно тот класс дефекта, что
 * «не падает, а тихо работает неправильно».
 *
 * ЧТО ДЕЛАЕТ. Читает константы из движка и проценты/дни из русского и
 * английского словаря условий, сверяет. Read-only, без сети и без базы.
 *
 * ЗАПУСК: node scripts/fan-terms-consistency.js
 * Выход: 0 — сходится, 1 — расхождение (с точным указанием, что где).
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ENGINE = path.join(ROOT, "src", "data", "fanDiscounts.ts");
const TERMS = path.join(ROOT, "..", "frontend", "src", "lib", "pricingI18n", "sections", "fan.ts");

function read(p) {
  if (!fs.existsSync(p)) {
    console.error(`не найден файл: ${p}`);
    process.exit(2);
  }
  return fs.readFileSync(p, "utf8");
}

const engine = read(ENGINE);
const terms = read(TERMS);

/** Достаём число из объявления константы движка. */
function constNum(re, label) {
  const m = engine.match(re);
  if (!m) {
    console.error(`не удалось прочитать ${label} из fanDiscounts.ts — канарейка сломана, не игнорировать`);
    process.exit(2);
  }
  return Number(m[1]);
}

const ringCap1 = Math.round(constNum(/FAN_RING_CAP[^=]*=\s*\{\s*1:\s*([0-9.]+)/, "FAN_RING_CAP[1]") * 100);
const ringCap2 = Math.round(constNum(/FAN_RING_CAP[^=]*=\s*\{\s*1:\s*[0-9.]+,\s*2:\s*([0-9.]+)/, "FAN_RING_CAP[2]") * 100);
const cogsCap = Math.round(constNum(/FAN_COGS_SENSITIVE_MAX_RATIO\s*=\s*([0-9.]+)/, "FAN_COGS_SENSITIVE_MAX_RATIO") * 100);
const windowDays = constNum(/FAN_WINDOW_DAYS\s*=\s*([0-9]+)/, "FAN_WINDOW_DAYS");
const levelStep = Math.round(constNum(/FAN_LEVEL_STEP\s*=\s*([0-9.]+)/, "FAN_LEVEL_STEP") * 100);
const maxLevel = constNum(/FAN_MAX_LEVEL\s*=\s*([0-9]+)/, "FAN_MAX_LEVEL");
// Общий потолок берётся из pricing.ts через MAX_PROMO_DISCOUNT_RATIO
const pricingSrc = read(path.join(ROOT, "src", "data", "pricing.ts"));
const comboCapM = pricingSrc.match(/MAX_PROMO_DISCOUNT_RATIO\s*=\s*([0-9.]+)/);
if (!comboCapM) {
  console.error("не удалось прочитать MAX_PROMO_DISCOUNT_RATIO из pricing.ts");
  process.exit(2);
}
const comboCap = Math.round(Number(comboCapM[1]) * 100);

console.log("Константы движка:");
console.log(`  ring1 cap ${ringCap1}% | ring2 cap ${ringCap2}% | COGS cap ${cogsCap}%`);
console.log(`  окно ${windowDays} дн | шаг уровня ${levelStep} п.п. | уровней ${maxLevel} | потолок скидок ${comboCap}%`);

/** Текст условий: ru + en в одном файле, проверяем оба. */
const checks = [
  { label: `ring1 cap ${ringCap1}%`, patterns: [`−${ringCap1}%`, `-${ringCap1}%`], expect: 2 },
  { label: `ring2 cap ${ringCap2}%`, patterns: [`−${ringCap2}%`, `-${ringCap2}%`], expect: 2 },
  { label: `COGS cap ${cogsCap}%`, patterns: [`${cogsCap}%`], expect: 2 },
  { label: `окно ${windowDays} дней`, patterns: [`${windowDays} дней`, `${windowDays}-day`, `${windowDays} days`], expect: 2 },
  { label: `шаг ${levelStep} п.п.`, patterns: [`${levelStep} процентных`, `${levelStep} percentage`], expect: 2 },
  { label: `потолок ${comboCap}%`, patterns: [`${comboCap}%`], expect: 2 },
];

let failed = 0;
for (const c of checks) {
  const hits = c.patterns.reduce((n, p) => n + (terms.split(p).length - 1), 0);
  if (hits >= c.expect) {
    console.log(`  ✓ ${c.label} — упомянут в условиях (${hits} совпадений)`);
  } else {
    console.error(
      `  ✗ ${c.label} — в условиях НЕ найден (нужно ≥${c.expect} совпадений на ru+en, найдено ${hits}).` +
        ` Искали: ${c.patterns.join(" / ")}`,
    );
    failed++;
  }
}

// Обратная проверка: в условиях не должно быть процентов, которых нет в движке.
const allowed = new Set([ringCap1, ringCap2, cogsCap, comboCap, levelStep].map(String));
const stray = [...terms.matchAll(/[−-](\d{2})%/g)].map((m) => m[1]).filter((v) => !allowed.has(v));
if (stray.length) {
  console.error(`  ✗ в условиях есть проценты, которых нет в движке: ${[...new Set(stray)].join(", ")}`);
  failed++;
} else {
  console.log("  ✓ посторонних процентов в условиях нет");
}

console.log(`\n${checks.length + 1} проверок — расхождений: ${failed}`);
if (failed > 0) {
  console.error(
    "Условия на /pricing/refund-policy#fan разошлись с движком. Правь либо константы,\n" +
      "либо тексты в frontend/src/lib/pricingI18n/sections/fan.ts — публичная оферта должна\n" +
      "описывать то, что код реально делает.",
  );
}
process.exit(failed > 0 ? 1 : 0);
