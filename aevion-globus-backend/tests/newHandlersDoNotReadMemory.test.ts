import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Обработчик не должен ПОДМЕНЯТЬ базу картой в памяти.
 *
 * Класс, найденный 27-28.08.2026 в шести модулях подряд:
 *
 *   QLearn   $15/мес - курс нельзя было завершить и получить сертификат;
 *   QMedia   $15/мес - база не использовалась ВООБЩЕ, всё терялось при выкатке;
 *   QStore   $15/мес - продавец видел "0 продаж, выручка 0" при настоящих;
 *   QNews     $9/мес - разделы, лента и сводка показывали ноль;
 *   QSocial           - поиск, лента тега и "в тренде" не находили ничего;
 *   QCoreAI           - ссылка совместного просмотра обещала сутки, жила часы.
 *
 * Данные ПИШУТСЯ в базу, а читаются из Map. На проде память пуста после каждой
 * выкатки, и ручка отвечает пустотой - законно на вид. Ни типы, ни обычные
 * тесты этого не видят; тесты особенно, ведь в них память как раз заполнена.
 *
 * ЧТО ЗАКОННО. Память рядом с базой - нормальный кэш и нормальный запасной
 * путь. Обработчик пропускается, если он спрашивает хранилище:
 *
 *   - напрямую (pool.query) или под isXxxDbReady();
 *   - через посредника - функцию этого же файла либо импорт из lib, внутри
 *     которых есть обращение к базе;
 *   - работая с картой, которую кто-то ПРОГРЕВАЕТ из базы (SELECT + rows),
 *     как делает warmFromDb() у QReal: там память переживает выкатку.
 *
 * Каждое освобождение оплачено ошибкой прибора, а не осторожностью:
 *
 *   искал pool.query в теле обработчика -> 35 ложных находок в DevHub, где
 *     слой зовётся dbGetProject и лежит в том же файле;
 *   освобождал по имени "db*"           -> покраснел бы на QLearn, чей слой
 *     зовётся myEnrollments, и на QMedia с listPublicTracks;
 *   не различал прогрев                 -> 11 ложных находок в QReal;
 *   считал прогревом запись рядом с INSERT -> потерял 3 НАСТОЯЩИХ места
 *     QSocial, где память пишется, но никогда не читается из базы.
 *
 * ГРАНИЦА, которую надо знать. Освобождение даётся ОБРАБОТЧИКУ целиком: если
 * он берёт одно из базы, а другое из памяти, сторож промолчит. Так и было у
 * сводки QCoreAI - сессию брала из базы, просмотры считала по памяти, и нашлась
 * она глазами, а не прибором. Пословный разбор потоков данных этому инструменту
 * не по силам, и делать вид, что по силам, вреднее, чем сказать прямо.
 *
 * Долга сейчас НЕТ: BASELINE пуст, и это состояние, а не оговорка. Появится
 * новое место - сторож покраснеет на нём одном.
 */

const SRC = path.join(__dirname, "..", "src");
const ROUTES = path.join(SRC, "routes");
const LIB = path.join(SRC, "lib");

/** Известные места. Пусто на 28.08.2026. Только сокращать. */
const BASELINE = new Set<string>([]);

const FN = /^(?:async function|function|const)\s+([A-Za-z_]\w*)/;
const ROUTE = /^[a-zA-Z_]+\.(?:get|post|put|patch|delete)\(\s*"/;

/** lib-модули, которые сами ходят в базу. */
function libsThatQuery(): Set<string> {
  const s = new Set<string>();
  for (const f of readdirSync(LIB).filter((x) => x.endsWith(".ts"))) {
    if (readFileSync(path.join(LIB, f), "utf8").includes("pool.query")) s.add(f.slice(0, -3));
  }
  return s;
}

/**
 * Куски файла. Границей служит и объявление функции, и НАЧАЛО МАРШРУТА: без
 * второго обработчики склеиваются в один кусок, и запись в память из одного
 * маршрута выглядит прогревом из-за SELECT в соседнем. Ровно так прибор и
 * терял три настоящих места QSocial.
 */
function chunks(lines: string[]): Array<{ name: string | null; body: string }> {
  const marks: Array<[number, string | null]> = [];
  lines.forEach((l, i) => {
    const m = FN.exec(l);
    if (m) marks.push([i, m[1]]);
    else if (ROUTE.test(l)) marks.push([i, null]);
  });
  return marks.map(([at, name], k) => ({
    name,
    body: lines.slice(at, k + 1 < marks.length ? marks[k + 1][0] : lines.length).join("\n"),
  }));
}

/**
 * Разбор ОДНОГО файла маршрутов. Отделён от обхода каталога намеренно: только
 * так сторожа можно прогнать на образцах, ответ для которых известен заранее.
 */
function offenders(mod: string, src: string, libs: Set<string>): string[] {
  const lines = src.split(/\r?\n/);
  const storage = new Set<string>();
  const hydrated = new Set<string>();
  for (const { name, body } of chunks(lines)) {
    if (!body.includes("pool.query")) continue;
    if (name) storage.add(name);
    // Прогрев - заполнение карты ПРОЧИТАННЫМ: рядом обязаны быть SELECT и
    // строки ответа. Запись в память рядом с INSERT прогревом не является.
    if (body.includes("SELECT") && body.includes(".rows")) {
      for (const m of body.matchAll(/\b(mem[A-Z]\w*)\.set\(/g)) hydrated.add(m[1]);
    }
  }
  const imp = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/lib\/([A-Za-z]+)"/g;
  for (let m = imp.exec(src); m; m = imp.exec(src)) {
    if (!libs.has(m[2])) continue;
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(" as ").pop()!.trim();
      if (n) storage.add(n);
    }
  }
  const starts: number[] = [];
  lines.forEach((l, i) => { if (ROUTE.test(l)) starts.push(i); });
  if (starts.length === 0) return [];
  starts.push(lines.length);
  const out: string[] = [];
  for (let k = 0; k < starts.length - 1; k++) {
    // Комментарии выбрасываем: разбор дефекта В КОММЕНТАРИИ не есть дефект.
    const code = lines
      .slice(starts[k], starts[k + 1])
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    const used = new Set<string>();
    for (const m of code.matchAll(/\b(mem[A-Z]\w*)\.(?:get|set|values|has|delete)\(/g)) used.add(m[1]);
    if (used.size === 0) continue;
    if (code.includes("DbReady()") || code.includes("pool.query")) continue;
    if ([...storage].some((n) => new RegExp("\\b" + n + "\\s*\\(").test(code))) continue;
    if ([...used].every((m) => hydrated.has(m))) continue;
    const m = /^[a-zA-Z_]+\.([a-z]+)\("([^"]*)"/.exec(lines[starts[k]]);
    if (m) out.push(mod + " " + m[1] + " " + m[2]);
  }
  return out;
}

function scan(): string[] {
  const libs = libsThatQuery();
  const found: string[] = [];
  for (const f of readdirSync(ROUTES).filter((x) => x.endsWith(".ts"))) {
    found.push(...offenders(f.slice(0, -3), readFileSync(path.join(ROUTES, f), "utf8"), libs));
  }
  return [...new Set(found)].sort();
}

describe("обработчик не подменяет базу памятью", () => {
  /**
   * Самопроверка на образцах. Нужна именно потому, что настоящих мест сейчас
   * ноль: без неё сломанный прибор давал бы ту же зелёную пустоту, что и
   * чистая платформа, и отличить одно от другого было бы нечем.
   */
  test("прибор различает подмену, запасной путь, слой и прогрев", () => {
    const libs = new Set<string>();
    const bad = [
      'r.get("/a", (q, s) => {',
      "  const v = memThings.get(q.params.id);",
      "  return s.json({ v });",
      "});",
    ].join("\n");
    expect(offenders("x", bad, libs), "подмену базы памятью прибор НЕ увидел").toEqual(["x get /a"]);

    const withQuery = bad.replace("const v =", "await pool.query('SELECT 1'); const v =");
    expect(offenders("x", withQuery, libs), "ложная тревога: обработчик спрашивает базу").toEqual([]);

    const withGuard = bad.replace("const v =", "if (!isThingDbReady()) return; const v =");
    expect(offenders("x", withGuard, libs), "ложная тревога: память под isXxxDbReady()").toEqual([]);

    const viaHelper = [
      "async function loadThing(id) {",
      "  const r = await pool.query('SELECT 1 FROM t');",
      "  return r.rows[0];",
      "}",
      bad.replace("const v =", "await loadThing(q.params.id); const v ="),
    ].join("\n");
    expect(offenders("x", viaHelper, libs), "ложная тревога: слой лежит в том же файле").toEqual([]);

    const warmed = [
      "async function warmUp() {",
      "  const r = await pool.query('SELECT * FROM t');",
      "  for (const row of r.rows) memThings.set(row.id, row);",
      "}",
      bad,
    ].join("\n");
    expect(offenders("x", warmed, libs), "ложная тревога: карту прогревают из базы").toEqual([]);
  });

  test("список не пополнился", () => {
    const fresh = scan().filter((x) => !BASELINE.has(x));
    expect(
      fresh,
      "обработчик читает карту памяти и НИ РАЗУ не спрашивает хранилище, а " +
        "карту никто не прогревает из базы. На проде память пуста после каждой " +
        "выкатки: ответ будет пустым и выглядеть законно. Читайте из базы - " +
        "напрямую, через слой или через lib; память оставляйте кэшем под " +
        "isXxxDbReady() либо прогревайте её из базы при старте.",
    ).toEqual([]);
  });

  test("починенное вычеркнуто из списка", () => {
    const live = new Set(scan());
    const stale = [...BASELINE].filter((x) => !live.has(x));
    expect(stale, "эти места уже починены - вычеркните их из BASELINE").toEqual([]);
  });
});
