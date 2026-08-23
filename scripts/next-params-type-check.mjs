#!/usr/bin/env node
// Тип `params` в страницах и лэйаутах Next.
//   node scripts/next-params-type-check.mjs
//
// Начиная с Next 15 `params` приходит промисом. Объявления вида
// `params: { id: string }` или `params: Promise<{…}> | {…}` роняют СБОРКУ:
// Next 16 генерирует PageProps со строгим `Promise<any>`, и объект под него
// не подходит.
//
// Зачем отдельная проверка, если это и так ловит сборка: сборка ловит поздно
// и дорого. 10.08.2026 полный `next build` компилировался 20.9 минуты и
// только потом упал на type check — а до того дефект был невидим, потому что
// ошибка живёт в сгенерированных `.next/types`, которых без билда просто нет.
// Ни dev-режим, ни `tsc` по исходникам его не показывают. Здесь то же самое
// выясняется за секунду, по исходникам, без сборки.
//
// Что делать, если тест упал:
//   • объявите `params: Promise<{ … }>` и берите значение через `await params`
//     (серверный компонент) или `use(params)` (клиентский);
//   • ручной тернар `typeof params.then === "function" ? use(params) : params`
//     тоже уберите — он существовал ровно ради этого объединения;
//   • починили зону — уменьшите BASELINE.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const APP = path.join(HERE, "..", "frontend", "src", "app");

/**
 * Сколько объявлений ещё допустимо. Только вниз.
 * Срез 10.08.2026: 5 — cyberchess 2, devhub 2, qpaynet 1. Все зоны заняты
 * другими сессиями; из-за этих пяти сборка фронтенда красная.
 * Корневая [id] и четыре страницы smeta-trainer закрыты в 3d467d47e.
 */
const BASELINE = 0;

// `params` и `searchParams`, объявленные объектным типом — сами по себе или
// в объединении с Promise. Данные вида `params: "текст"` и `let params: any`
// под это не попадают: требуется фигурная скобка.
//
// searchParams здесь не ради текущего кода — там он везде уже промис. Он тут
// потому, что мигрировал теми же руками и в ту же сторону, и проверка,
// знающая одну форму из двух, пропустит вторую молча. Сегодня я на этом уже
// обжёгся дважды: храповики не видели одинарных кавычек.
const BAD_PARAMS = /\bsearchParams:\s*(?:Promise<[^>]*>\s*\|\s*)?\{[^}]*\}|(?<!search)\bparams:\s*(?:Promise<[^>]*>\s*\|\s*)?\{[^}]*\}/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^(page|layout)\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(APP)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(BAD_PARAMS)) {
    hits.push(`${path.relative(APP, file).split(path.sep).join("/")} :: ${m[0].replace(/\s+/g, " ")}`);
  }
}

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

console.log(`страниц с неверным типом params: ${hits.length} (планка ${BASELINE})`);

ok(
  "новых страниц с объектным params не появилось",
  hits.length <= BASELINE,
  `стало ${hits.length} против ${BASELINE}. Объявите params: Promise<{…}> — иначе сборка упадёт на type check.`,
);

ok(
  "планка соответствует факту",
  hits.length === BASELINE,
  hits.length < BASELINE ? `осталось ${hits.length} — уменьшите BASELINE, чтобы храповик затянулся.` : "",
);

if (hits.length) {
  console.log("\nостаются:");
  for (const h of hits) console.log(`  ${h}`);
}

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
