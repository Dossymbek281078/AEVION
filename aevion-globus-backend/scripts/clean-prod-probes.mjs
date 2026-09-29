#!/usr/bin/env node
/**
 * Уборка НАШИХ ПРОБ с прода: сухой прогон → копия строк → удаление в транзакции.
 *
 * Зачем скрипт, а не запрос руками. Правило основателя: данные прода меняются
 * только с копией строк, возможностью откатить и сверкой счёта в транзакции.
 * Запрос, набранный в консоли, ни одного из трёх условий не выполняет.
 *
 * Что убирает (журнал `00-НАЧНИ-ОТСЮДА/2026-09-29-ЖУРНАЛ-проб-на-проде.md`):
 *   • адреса в `constitution_waitlist`, похожие на пробу (smoke-…, probe-…, test-…);
 *   • ничего больше: таблица лидеров шахмат правится не здесь. Наша запись в ней
 *     СКРЫТА при чтении (routes/cyberchessDaily.ts, `публичныеЗаписи`), потому что
 *     скрыть обратимо, а удалять на живом проде ради косметики незачем.
 *
 * ⚠️ ПО УМОЛЧАНИЮ — СУХОЙ ПРОГОН. Удаление только с `--удалить`, и только после
 * того, как сухой прогон показал ровно те строки, которые вы ожидали.
 *
 *   node scripts/clean-prod-probes.mjs                 # показать, ничего не менять
 *   node scripts/clean-prod-probes.mjs --удалить       # удалить, с копией и сверкой
 *
 * Нужен `DATABASE_URL` прода в окружении. Коды выхода: 0 — сделано (или сухой
 * прогон прошёл), 1 — есть расхождение/нечего делать не удалось подтвердить,
 * 2 — не выполнился (нет доступа, обрыв). Код 2 — это НЕ «чисто».
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const УДАЛЯТЬ = process.argv.includes("--удалить");

/** Те же слова, что у `src/lib/probeRows.ts`; разделитель обязателен. */
const СЛОВА = ["smoke", "probe", "test"];
function похожеНаПробу(адрес) {
  const v = String(адрес ?? "").trim().toLowerCase();
  for (const w of СЛОВА) {
    if (v === w) return true;
    if (v.startsWith(w) && /^[-_ :.\/]/.test(v.slice(w.length))) return true;
  }
  return false;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL не задан — спросить базу нечем. Это код 2, а не «чисто».");
    process.exit(2);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("модуль pg не установлен — запускайте из aevion-globus-backend. Код 2.");
    process.exit(2);
  }

  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  try {
    // 1. СУХОЙ ПРОГОН: показываем строки целиком, чтобы глаз увидел, что удаляем.
    const { rows } = await client.query(
      `SELECT "email", "createdAt" FROM constitution_waitlist ORDER BY "createdAt" ASC`,
    );
    const пробы = rows.filter((r) => похожеНаПробу(r.email));
    const люди = rows.length - пробы.length;

    console.log(`всего в списке: ${rows.length} | похожи на пробу: ${пробы.length} | люди: ${люди}`);
    for (const r of пробы) console.log(`  УДАЛИТЬ: ${r.email}  (создано ${r.createdAt})`);

    // Контроль в обе стороны: печатаем и то, что НЕ удаляем, если список короткий.
    if (люди > 0 && люди <= 10) {
      for (const r of rows.filter((r) => !похожеНаПробу(r.email))) console.log(`  оставить: ${r.email}`);
    }

    if (!пробы.length) {
      console.log("проб не найдено — удалять нечего");
      return 0;
    }
    if (!УДАЛЯТЬ) {
      console.log("\nСУХОЙ ПРОГОН. Ничего не изменено. Удаление: добавьте --удалить");
      return 0;
    }

    // 2. КОПИЯ СТРОК на диск — до всякого удаления, иначе откатывать будет нечем.
    const каталог = join(process.cwd(), "logs");
    mkdirSync(каталог, { recursive: true });
    const файл = join(каталог, `probes-removed-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
    writeFileSync(файл, JSON.stringify(пробы, null, 2), "utf8");
    console.log(`копия строк: ${файл}`);

    // 3. УДАЛЕНИЕ В ТРАНЗАКЦИИ СО СВЕРКОЙ СЧЁТА. Удалено должно быть РОВНО
    // столько, сколько показал сухой прогон: больше — значит условие шире, чем
    // мы думали, и тогда откат.
    await client.query("BEGIN");
    const адреса = пробы.map((r) => r.email);
    const del = await client.query(`DELETE FROM constitution_waitlist WHERE "email" = ANY($1::text[])`, [адреса]);
    if (del.rowCount !== пробы.length) {
      await client.query("ROLLBACK");
      console.error(`СВЕРКА НЕ СОШЛАСЬ: удалено ${del.rowCount}, ожидалось ${пробы.length} — откат, ничего не изменено`);
      return 1;
    }
    await client.query("COMMIT");
    console.log(`удалено ${del.rowCount}, сверка сошлась. Восстановить: строки в ${файл}`);
    return 0;
  } finally {
    await client.end().catch(() => {});
  }
}

main()
  .then((код) => process.exit(код))
  .catch((e) => {
    console.error("не выполнился:", e instanceof Error ? e.message : e);
    process.exit(2);
  });
