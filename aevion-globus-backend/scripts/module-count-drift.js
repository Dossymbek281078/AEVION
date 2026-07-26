#!/usr/bin/env node
/**
 * Канарейка: заявленное ЧИСЛО МОДУЛЕЙ на витринах против реестров.
 *
 * Повод — 2026-07-27. На одной OG-карточке прайса одновременно стояли
 * «37 модулей в одной подписке» и «27 модулей», при том что в
 * `data/pricing.ts` их 43, а в `data/projects.ts` — 41. Ни одно из двух чисел
 * не соответствовало ничему: они пережили несколько расширений каталога.
 * Цены сторожит `public-price-drift.js`; счётчики не сторожило ничто.
 *
 * Правило проверки: число рядом со словом «модул/module» на витрине обязано
 * совпадать с ОДНИМ ИЗ реальных счётчиков. Какой именно уместен — решает
 * автор текста; канарейка ловит числа, которые не соответствуют НИ ОДНОМУ,
 * то есть заведомо устаревшие.
 *
 * Запуск: node scripts/module-count-drift.js   (включён в all-smokes.js)
 */
const { readFileSync, existsSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const REPO = join(__dirname, "..", "..");
const FRONTEND = join(REPO, "frontend", "src");

function readSrc(p) {
  return readFileSync(join(__dirname, "..", "src", "data", p), "utf8");
}

/** Реальные счётчики — считаем по исходникам реестров, без импорта TS. */
function trueCounts() {
  const pricingSrc = readSrc("pricing.ts");
  const projects = readSrc("projects.ts");
  // Считаем ТОЛЬКО внутри массива MODULES_PRICING: снаружи `addonMonthly`
  // встречается в интерфейсе и в комментариях, и первый вариант канарейки
  // из-за этого сообщал 45 вместо 43 — счётчик, которому нельзя верить,
  // хуже отсутствующего.
  const start = pricingSrc.indexOf("export const MODULES_PRICING");
  const end = start >= 0 ? pricingSrc.indexOf("\n];", start) : -1;
  const pricing = start >= 0 && end > start ? pricingSrc.slice(start, end) : "";
  if (!pricing) {
    console.error("Не удалось найти массив MODULES_PRICING — канарейка бесполезна, чини её.");
    process.exit(2);
  }
  // Считаем НАЧАЛА объектов, а не поля: `addonMonthly` упоминается ещё и в
  // комментарии внутри одной из записей, из-за чего счёт давал 44 вместо 43.
  // Канарейка, чьи собственные числа неверны, хуже отсутствующей — она
  // забракует правильную цифру на витрине.
  const modules = [...pricing.matchAll(/^ {2}\{/gm)].length;
  const paid = [...pricing.matchAll(/addonMonthly:\s*(\d+(?:\.\d+)?)/g)].filter((m) => Number(m[1]) > 0).length;
  const inFull = [...pricing.matchAll(/includedIn:\s*\[[^\]]*"full"[^\]]*\]/g)].length;
  const projectCount = [...projects.matchAll(/^\s{2}\{\s*$/gm)].length || [...projects.matchAll(/id:\s*"/g)].length;
  return { modules, paid, inFull, projects: projectCount };
}

/** Витрины, где число модулей — обещание покупателю. */
const SURFACES = ["app/pricing", "data/pitchModel.ts", "data/pitchFacts.ts"];

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  if (statSync(dir).isFile()) return acc.concat(dir);
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx?|mdx?)$/.test(p) && !/__tests__|\.test\./.test(p)) acc.push(p);
  }
  return acc;
}

/**
 * Исключения — только с причиной. «30+ стран», «10 000 токенов» и прочее
 * рядом со словом «модуль» не стоит, но соседние числа ловятся легко.
 */
const ALLOW = [
  { needle: "modules: null", why: "поле лимита тарифа, не счётчик витрины" },
  { needle: "27 проектов", why: "историческое имя экосистемы в тексте о прошлом" },
  // Шапка pitchFacts.ts — это ДОКУМЕНТАЦИЯ о самом расхождении: она перечисляет,
  // какими словами число называли в разных файлах («29 modules», «37 product
  // nodes»). Заменить их на актуальные — стереть предмет объяснения.
  { needle: 'files with slightly different wording', why: "комментарий о прошлых формулировках, не обещание" },
  { needle: 'The public-facing "37 product nodes"', why: "тот же комментарий, вторая строка" },
  // Производное число, а не счётчик реестра: 43 модуля в прайсе − 3 флагмана,
  // разобранных в модели по отдельности, = 40. Правило «совпадает с реестром»
  // такие выводы не покрывает, поэтому вывод записан здесь и проверяем глазами.
  { needle: "the other 40 modules are upside", why: "43 в прайсе − 3 флагмана = 40" },
];

const counts = trueCounts();
const allowed = new Set(Object.values(counts));
console.log(
  "Реальные счётчики: " +
    `в прайсе=${counts.modules}  платных=${counts.paid}  входит в Full=${counts.inFull}  проектов=${counts.projects}`,
);

const problems = [];
// «43 модуля», «27 modules», «37 модулей в одной подписке»
const CLAIM = /(\d{1,3})\s*(?:\+)?\s*(модул\w*|module[s]?|продукт\w*|product[s]?)/gi;

for (const surface of SURFACES) {
  for (const file of walk(join(FRONTEND, surface))) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (ALLOW.some((a) => line.includes(a.needle))) return;
        for (const m of line.matchAll(CLAIM)) {
          const n = Number(m[1]);
          // Мелкие числа — это «3 места», «2 месяца», перечисления фич.
          if (n < 20 || n > 200) continue;
          if (allowed.has(n)) continue;
          problems.push(
            `${relative(REPO, file)}:${i + 1} — «${m[0].trim()}» не совпадает ни с одним реальным счётчиком\n      ${line.trim().slice(0, 120)}`,
          );
        }
      });
  }
}

if (problems.length) {
  // Полноценный ГЕЙТ: копирайт приведён к реестрам 2026-07-27 (было 16 находок
  // — четыре разных счётчика 27/29/37/38, ни один не совпадал). Дальше любое
  // расхождение должно ронять смоук, а не печатать предупреждение в пустоту.
  // REPORT_ONLY=1 временно ослабляет, если понадобится разбирать пачку правок.
  const gate = process.env.REPORT_ONLY !== "1";
  const log = gate ? console.error : console.warn;
  log(`\n${gate ? "❌" : "⚠️"} Счётчики модулей разошлись с реестрами — ${problems.length}:\n`);
  for (const p of problems) log(`  ${gate ? "✗" : "•"} ` + p);
  log(
    "\nЧисло модулей на продающей странице берётся из реестра, а не из памяти.\n" +
      "Уместный счётчик выбирает автор текста — но он обязан быть одним из реальных.\n" +
      (gate ? "" : "REPORT_ONLY=1 — это предупреждение, а не гейт.\n"),
  );
  if (gate) process.exit(1);
}

console.log(`\n✓ все счётчики модулей на витринах совпадают с реестрами\n`);
