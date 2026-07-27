/**
 * Здоровье денежного контура — один прогон вместо трёх.
 *
 * Собирает под одной крышей проверки, которые до 26.07.2026 жили порознь и
 * запускались по памяти:
 *   1. страницы, на которых лежат деньги, отвечают (pages-live-smoke);
 *   2. каталог совпадает с живыми карточками оплаты — цена, периодичность
 *      списания, дисклеймер у демо-модулей (catalog-vs-checkout).
 *
 * Запуск:  node scripts/money-health.js
 * Код возврата 1, если хоть одна часть красная — годится для крона и CI.
 *
 * Зачем вместе. Обе проверки отвечают на один вопрос — «деньги ещё принимаются
 * и то, что мы обещаем, правда?» — но раньше ответ надо было собирать из двух
 * мест, а значит его никто не собирал. Разделение проверок по файлам полезно
 * для отладки и вредно для дежурного взгляда.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const STEPS = [
  {
    name: "Страницы с деньгами отвечают",
    script: "pages-live-smoke.js",
    hint: "витрина, qmelanin, qrenew, longevity и остальные публичные страницы",
  },
  {
    name: "Каталог совпадает с карточками оплаты",
    script: "catalog-vs-checkout.js",
    hint: "цена, периодичность списания, дисклеймер у демо-модулей",
  },
];

let failed = 0;
const summary = [];

for (const step of STEPS) {
  const file = path.join(__dirname, step.script);
  console.log(`\n${"─".repeat(70)}\n▶ ${step.name}\n  (${step.hint})\n${"─".repeat(70)}`);

  const r = spawnSync(process.execPath, [file], { stdio: "inherit" });
  const code = r.status ?? 1;
  if (code !== 0) failed++;
  summary.push({ name: step.name, ok: code === 0, code });
}

console.log(`\n${"═".repeat(70)}\nЗДОРОВЬЕ ДЕНЕЖНОГО КОНТУРА\n${"═".repeat(70)}`);
for (const s of summary) {
  console.log(`  ${s.ok ? "OK  " : "FAIL"}  ${s.name}${s.ok ? "" : `  (код ${s.code})`}`);
}
console.log(
  failed === 0
    ? "\nВсё сходится: страницы живы, обещания на витрине совпадают с тем, что видит покупатель."
    : `\nКрасных частей: ${failed}. Подробности — в выводе выше.`,
);

process.exit(failed ? 1 : 0);
