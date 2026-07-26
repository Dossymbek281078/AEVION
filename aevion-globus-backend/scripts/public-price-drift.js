#!/usr/bin/env node
/**
 * Канарейка: цены на ПУБЛИЧНЫХ витринах против data/pricing.ts.
 *
 * Повод — 2026-07-27. Репрайсинг 22.07 поднял lite/medium/full с 19/29/49 до
 * 24/39/89 в `data/pricing.ts`, но копирайт остался прежним. Найдено прогоном:
 * пятнадцать мест в трёх локалях и три OG-карточки продолжали обещать «$19/мес»,
 * «$190 вместо $228» и тариф «PRO $19», которого в схеме больше нет. Чекаут при
 * этом списывал $24 — то самое «показали одно, спишут другое», только на
 * маркетинговой стороне, где его никто не искал.
 *
 * Что проверяем: любое упоминание СТАРОЙ цены тарифа на витринах. Это дешёвая
 * проверка «нет ли числа, которого точно не должно быть», а не полная сверка —
 * полную сделать нельзя, пока цифры в копирайте зашиты строками.
 *
 * Запуск: node scripts/public-price-drift.js   (включён в all-smokes.js)
 */
const { readFileSync, existsSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const REPO = join(__dirname, "..", "..");
const FRONTEND = join(REPO, "frontend", "src");

/** Цены тарифов из ЖИВОГО прайса — источник истины. */
function currentTierPrices() {
  const src = readFileSync(join(__dirname, "..", "src", "data", "pricing.ts"), "utf8");
  const out = {};
  const re = /id:\s*"(free|lite|medium|full|pro|enterprise)"[\s\S]{0,400}?priceMonthly:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = Number(m[2]);
  return out;
}

/**
 * Цены, которые тариф носил РАНЬШЕ. Пополнять при каждом репрайсинге — это и
 * есть предмет проверки: «старое число не должно встречаться на витрине».
 */
const RETIRED = [
  { was: 19, tier: "lite", since: "2026-07-22", now: 24 },
  { was: 29, tier: "medium", since: "2026-07-22", now: 39 },
  { was: 49, tier: "full", since: "2026-07-22", now: 89 },
  { was: 190, tier: "lite (год)", since: "2026-07-22", now: 240 },
  { was: 228, tier: "lite (12×мес)", since: "2026-07-22", now: 288 },
];

/** Только витрины прайса — иначе поймаем цены чужих продуктов ($19 за сертификат). */
const SURFACES = [
  "app/pricing",
  // Питч — тоже витрина, только для инвестора. `pitchModel.economics.margin`
  // рендерится на /pitch (page.tsx:982) и до 2026-07-27 называл цены
  // 19/29/49, снятые ещё 22.07.
  "data/pitchModel.ts",
  "data/pitchFacts.ts",
  "components/PaywallModal.tsx",
  "components/PaywallScreen.tsx",
  "components/ModulePricingChip.tsx",
  "components/FanDiscountPanel.tsx",
];
/** Ключи копирайта прайса в общем словаре. */
const DICT = { file: "lib/i18n-data.ts", keyPrefix: '"pricing.' };

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  if (statSync(dir).isFile()) return acc.concat(dir);
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    // api-pricing — СВОЯ лестница планов API (dev/build/scale), её $49 к
    // платформенным тарифам отношения не имеет. Проверено 2026-07-27: было
    // ложное срабатывание.
    else if (/\.(tsx?|mdx?)$/.test(p) && !/__tests__|\.test\.|api-pricing/.test(p)) acc.push(p);
  }
  return acc;
}

/**
 * Исключения — только с ПРИЧИНОЙ и только там, где число проверено.
 * Разобрано 2026-07-27 прогоном `getModulePrice`.
 */
const ALLOW = [
  { needle: "Paid add-on $29/mo over known unit economics", why: "цена модуля qreal ($29), не тариф Medium" },
  { needle: "$49/mo Pro (~$470/yr annual) — undercuts HH", why: "бизнес-утверждение о плане QBuild; в реестре модуль стоит $19 — расхождение вынесено основателю, не правится кодом" },
];

const problems = [];

for (const surface of SURFACES) {
  for (const file of walk(join(FRONTEND, surface))) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, i) => {
      // Комментарии обычно история, а не витрина — но в pitch*.ts именно в них
      // записан «текущий прайс», и он там уже разъезжался. Их проверяем.
      const isPitch = /pitch(Model|Facts)\.ts$/.test(file);
      if (!isPitch && /^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const r of RETIRED) {
        // Именно "$19", а не "$190" и не "119": цена — целиком.
        const re = new RegExp(`\\$${r.was}(?![0-9])`);
        if (re.test(line)) {
          if (ALLOW.some((a) => line.includes(a.needle))) continue;
          problems.push(
            `${relative(REPO, file)}:${i + 1} — $${r.was} (цена ${r.tier} до ${r.since}, сейчас $${r.now})\n      ${line.trim().slice(0, 120)}`,
          );
        }
      }
    });
  }
}

// Словарь: смотрим только строки с ключами прайса.
const dictPath = join(FRONTEND, DICT.file);
if (existsSync(dictPath)) {
  readFileSync(dictPath, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.includes(DICT.keyPrefix)) return;
      for (const r of RETIRED) {
        if (new RegExp(`\\$${r.was}(?![0-9])`).test(line)) {
          problems.push(
            `${relative(REPO, dictPath)}:${i + 1} — $${r.was} (${r.tier} до ${r.since}, сейчас $${r.now})\n      ${line.trim().slice(0, 120)}`,
          );
        }
      }
    });
}

const live = currentTierPrices();
console.log("Живой прайс:", Object.entries(live).map(([k, v]) => `${k}=$${v}`).join("  "));

// Канарейка на саму канарейку: если прайс вдруг вернулся к старым числам,
// список RETIRED врёт, и проверка выше молча теряет смысл.
for (const r of RETIRED) {
  const tierId = r.tier.split(" ")[0];
  if (live[tierId] === r.was) {
    problems.push(
      `RETIRED устарел: ${tierId} снова стоит $${r.was} — убери его из списка, иначе канарейка ловит верную цену`,
    );
  }
}

if (problems.length) {
  console.error(`\n❌ Устаревшие цены на витринах прайса — ${problems.length}:\n`);
  for (const p of problems) console.error("  ✗ " + p);
  console.error(
    "\nЦены на продающих страницах берутся из фактического прайса, а не из памяти.\n" +
      "Если репрайсинг намеренный — обнови копирайт и допиши старое число в RETIRED.\n",
  );
  process.exit(1);
}

console.log(`\n✓ витрины прайса не обещают ни одной снятой цены (${RETIRED.length} проверок)\n`);
