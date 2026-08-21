#!/usr/bin/env node
/**
 * Кто из модулей умеет ответить «я настоящий или демонстрационный».
 *
 * Зачем. 21.08.2026 нашлось, что QSign на проде подписывает хешем, а не
 * подписью. Нашлось ЗА СЕКУНДУ — потому что его `/health` сам сказал
 * `mode: "preview", reason: "seed_unset"`. Тот же вопрос про бюро занял час
 * и остался без точного ответа: поля нет вовсе.
 *
 * Отсюда правило, ради которого написан этот отчёт: «работает урезанно» —
 * плохо, но честно, состояние известно. «Неизвестно, в каком режиме» — хуже:
 * вопрос даже не задаётся, всё выглядит нормально, пока кто-нибудь не полезет
 * в код.
 *
 * Отчёт НЕ ругается и ничего не ломает. Он делит модули на три группы и тем
 * самым показывает, куда добавить одно поле.
 *
 * Запуск:
 *   BASE=https://api.aevion.app node scripts/mode-visibility-report.mjs
 *
 * Читающий, безопасен на проде. Код выхода всегда 0: это отчёт, а не сторож —
 * молчащий модуль не дефект, а место, где стоит добавить поле.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Ручки состояния собираем ИЗ КОДА: список в документе устаревает первым. */
function healthPaths() {
  const index = readFileSync(join(SRC, "index.ts"), "utf8");
  const imp = new Map();
  for (const m of index.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/routes\/([\w./-]+)"/g)) {
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(/\s+as\s+/).pop().trim();
      if (n) imp.set(n, m[2]);
    }
  }
  const out = [];
  for (const m of index.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
    const f = imp.get(m[2]);
    if (!f) continue;
    let src;
    try { src = readFileSync(join(SRC, "routes", f + ".ts"), "utf8"); } catch { continue; }
    for (const r of src.matchAll(/\w*[Rr]outer\.get\(\s*"(\/health[a-z]*|\/healthz)"/g)) {
      out.push(m[1] + r[1]);
    }
  }
  return [...new Set(out)].sort();
}

// Слова, которыми модуль СООБЩАЕТ свой режим. Ищем не «плохое», а НАЛИЧИЕ
// ответа на вопрос: preview/stub/demo/real/configured — всё это ответы.
const SAYS_MODE = /"(mode|engine|configured|ephemeral|attested|primaryProvider|store|reason)"\s*:/i;
const SAYS_DEGRADED = /"(preview|stub|demo|memory|fallback)"|:\s*false/i;

const paths = healthPaths();
const rows = [];
for (const p of paths) {
  try {
    const r = await fetch(BASE + p, { signal: AbortSignal.timeout(15000) });
    const t = (await r.text()).slice(0, 2000);
    rows.push({ p, code: r.status, mode: SAYS_MODE.test(t), degraded: SAYS_DEGRADED.test(t), t });
  } catch (e) {
    rows.push({ p, code: 0, mode: false, degraded: false, t: "" });
  }
}

const answered = rows.filter((r) => r.mode);
const silent = rows.filter((r) => r.code === 200 && !r.mode);
const dead = rows.filter((r) => r.code !== 200);

console.log(`ручек состояния: ${rows.length}  (цель ${BASE})\n`);
console.log(`  ✅ сообщают свой режим:      ${answered.length}`);
console.log(`  ⚪ отвечают, но режим молчат: ${silent.length}`);
console.log(`  ❌ не ответили:              ${dead.length}\n`);

if (answered.length) {
  console.log("СООБЩАЮТ (из них с признаками урезанного режима помечены ⚠):");
  for (const r of answered) console.log(`  ${r.degraded ? "⚠" : " "} ${r.p}`);
}
if (silent.length) {
  console.log("\nМОЛЧАТ О РЕЖИМЕ — сюда стоит добавить одно поле:");
  for (const r of silent) console.log(`    ${r.p}`);
}
if (dead.length) {
  console.log("\nНЕ ОТВЕТИЛИ:");
  for (const r of dead) console.log(`    ${r.p} (код ${r.code})`);
}
