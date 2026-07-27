/**
 * Проверка lib/csv.ts — защиты CSV-выгрузок.
 *
 * Запуск (сначала собрать: npx tsc):
 *   node scripts/csv-safety-test.js
 *
 * Гоняет СОБРАННЫЙ код из dist/, а не исходник. Это не придирка: 26.07.2026
 * первый прогон этой самой проверки шёл против устаревшего dist (сборка не
 * запустилась) и «показал», что защиты нет. Судить надо по артефакту.
 *
 * Что защищаем. Удвоение кавычек закрывает структуру файла, но не читателя:
 * значение с ведущим = + - @ Excel и Google Sheets исполняют как ФОРМУЛУ при
 * открытии. В выгрузках AEVION лежат поля, которые заполняет посторонний —
 * User-Agent просмотра документа, имя и сообщение соискателя, email и utm-метки
 * лида, заголовки объектов QRight. Открывает файл администратор.
 *
 * Тест держит обе стороны: формулы гасятся И обычные данные не портятся.
 * Вторая половина не менее важна — защита, ломающая живые значения, будет снята
 * первым же, кому она помешает.
 */

const { csvEscape, csvNeutralizeFormula, csvFromRows } = require("../dist/lib/csv.js");

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`);
}

/* ── Формулы гасятся ─────────────────────────────────────────────────────── */

const FORMULAS = [
  "=cmd|'/c calc'!A0",
  '=HYPERLINK("http://evil","click")',
  "+1+1",
  "-2+3",
  "@SUM(A1)",
  "\tведущая табуляция",
  "\rведущий возврат каретки",
];

for (const f of FORMULAS) {
  check(`гасится: ${JSON.stringify(f)}`, csvNeutralizeFormula(f), `'${f}`);
}

// csvEscape должен гасить формулу ДО оборачивания в кавычки — иначе апостроф
// окажется не первым символом ячейки и Excel всё равно посчитает её формулой.
check(
  "csvEscape гасит до кавычек",
  csvEscape("=1+1"),
  "\"'=1+1\"",
);

/* ── Обычные данные не портятся ──────────────────────────────────────────── */

check("e-mail не трогается (не начинается с @)", csvNeutralizeFormula("ivan@mail.ru"), "ivan@mail.ru");
check("User-Agent проходит как есть", csvNeutralizeFormula("Mozilla/5.0 (Windows NT 10.0)"), "Mozilla/5.0 (Windows NT 10.0)");
check("кириллица не трогается", csvNeutralizeFormula("Иван Петров"), "Иван Петров");
check("минус внутри строки не считается формулой", csvNeutralizeFormula("Астана-2026"), "Астана-2026");
check("отрицательное число — гасится намеренно", csvNeutralizeFormula("-5"), "'-5");

/* ── Структура CSV цела ──────────────────────────────────────────────────── */

check("кавычки удваиваются", csvEscape('он сказал "да"'), '"он сказал ""да"""');
check("запятая внутри поля", csvEscape("Петров, Иван"), '"Петров, Иван"');
check("перенос строки внутри поля", csvEscape("строка1\nстрока2"), '"строка1\nстрока2"');
check("null → пустая ячейка", csvEscape(null), '""');
check("число проходит", csvEscape(42), '"42"');
check("строка из значений", csvFromRows([["=1+1", "ok"]]), "\"'=1+1\",\"ok\"");

console.log(`\ncsv-safety: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
