#!/usr/bin/env node
/**
 * POST /api/puzzles/seed — засев обязан ОБНОВЛЯТЬ тему у существующих задач.
 *
 * 12.08.2026 ручка вставляла через `ON CONFLICT ("id") DO NOTHING`. Идентификатор
 * задачи — li_<id> из дампа Lichess, у всех 500 000 уже лежащих записей он
 * совпадает, поэтому исправленная раскладка тем молча отбрасывалась: пересев
 * банка не изменил бы НИЧЕГО. При этом счётчик в ответе рос на каждой попытке,
 * и ответ рапортовал «upserted: 500000» при нуле реальных вставок — тихая
 * неправильная работа с отчётом об успехе.
 *
 * Тест гоняет НАСТОЯЩИЙ Postgres (pglite — сборка postgres в wasm), а не
 * заглушку: проверять семантику ON CONFLICT и xmax на подделке бессмысленно,
 * ровно она тут и решает. Боевая база не нужна, пароли не нужны, работает
 * оффлайн.
 *
 * Usage: node scripts/puzzles-seed-upsert-test.mjs
 * Коды выхода: 0 — всё сходится; 1 — расхождение; 2 — не смог проверить.
 */

// ВАЖНО про зависимость: @electric-sql/pglite приходит ТРАНЗИТИВНО, через
// prisma → @prisma/dev. В package.json её нет. Обновление prisma однажды может
// её унести, и тогда тест должен сказать это словами, а не упасть трассировкой —
// поэтому импорт динамический и внутри try. Чтобы сделать проверку постоянной,
// нужна одна строка в devDependencies; правка package.json по правилам репозитория
// требует подтверждения, поэтому здесь её нет.
let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.error("НЕ СМОГ ПРОВЕРИТЬ: нет модуля @electric-sql/pglite.");
  console.error("Он приходил транзитивно через prisma. Чтобы проверка работала всегда:");
  console.error("  npm i -D @electric-sql/pglite");
  process.exit(2);
}

// Запрос ДОЛЖЕН совпадать с тем, что в src/routes/puzzles.ts. Держим рядом
// проверку: тест, разошедшийся с кодом, охраняет прошлое, а не настоящее.
const UPSERT = `INSERT INTO "ChessPuzzle" ("id","fen","sol","name","rating","theme","phase","side","goal","mateIn")
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
   ON CONFLICT ("id") DO UPDATE SET
     "name"=EXCLUDED."name", "rating"=EXCLUDED."rating", "theme"=EXCLUDED."theme",
     "phase"=EXCLUDED."phase", "goal"=EXCLUDED."goal", "mateIn"=EXCLUDED."mateIn"
   RETURNING (xmax = 0) AS inserted`;

let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (ожидалось ${want})`}`);
};

const row = (id, theme, fen = "fen1", sol = "[]") =>
  [id, fen, sol, "Задача", 1500, theme, "Middlegame", "w", "Best move", null];

let db;
try {
  db = new PGlite();
  await db.exec(`CREATE TABLE "ChessPuzzle"(
    "id" text PRIMARY KEY, "fen" text, "sol" text, "name" text, "rating" int,
    "theme" text, "phase" text, "side" text, "goal" text, "mateIn" int);`);
} catch (e) {
  console.error("НЕ СМОГ ПРОВЕРИТЬ: не поднялся pglite —", e instanceof Error ? e.message : e);
  process.exit(2);
}

const themeOf = async (id) =>
  (await db.query(`SELECT theme FROM "ChessPuzzle" WHERE id=$1`, [id])).rows[0]?.theme;

// Исходное состояние — ровно то, что на проде: у задачи на связку стоит фаза.
await db.query(`INSERT INTO "ChessPuzzle" VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
  row("li_1", "Миттельшпиль"));

// DO NOTHING на конфликте не возвращает НИ ОДНОЙ строки. Без этой обёртки
// возврат к старому запросу ронял тест с TypeError вместо объяснения: проверено
// мутацией 12.08.2026. Сторож, отвечающий трассировкой стека, заставляет
// читателя лезть в код вместо того, чтобы сразу понять, что сломано.
const verdict = (r) =>
  r.rows?.length ? r.rows[0].inserted : "строк не вернулось (похоже на DO NOTHING)";

console.log("Засев по существующей задаче:");
const r1 = await db.query(UPSERT, row("li_1", "Связка"));
check("тема обновилась", await themeOf("li_1"), "Связка");
check("отчитался как обновление, а не вставка", verdict(r1), false);

console.log("Засев новой задачи:");
const r2 = await db.query(UPSERT, row("li_2", "Рентген"));
check("тема записана", await themeOf("li_2"), "Рентген");
check("отчитался как вставка", verdict(r2), true);

console.log("Позиция и решение при обновлении:");
const before = (await db.query(`SELECT fen, sol FROM "ChessPuzzle" WHERE id='li_1'`)).rows[0];
await db.query(UPSERT, row("li_1", "Связка", "ДРУГОЙ_FEN", '["x"]'));
const after = (await db.query(`SELECT fen, sol FROM "ChessPuzzle" WHERE id='li_1'`)).rows[0];
// fen и sol намеренно НЕ в списке обновляемых полей: для того же id позиция не
// меняется, а перезапись скрыла бы порчу дампа.
check("fen не тронут", after.fen, before.fen);
check("sol не тронут", after.sol, before.sol);

console.log("");
if (failed) {
  console.error(`ПРОВАЛ: расхождений ${failed}. Засев снова не перезапишет темы —`);
  console.error("пересев банка пройдёт впустую и отчитается об успехе.");
  process.exit(1);
}
console.log("Засев обновляет темы и честно считает вставленные и обновлённые.");
process.exit(0);
