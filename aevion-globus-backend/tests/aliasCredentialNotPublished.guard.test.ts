import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Если модуль проверяет права по псевдониму — он не должен этот псевдоним
 * публиковать.
 *
 * ЗАЧЕМ. В проекте ДВЕ законные модели прав, и это выяснилось дорого (28.07,
 * три круга ложных выводов): вход по токену (`verifyBearer` / `requireAuth`) и
 * владение по псевдониму. Вторая работает — доказывает `lifebox`, — но ровно при
 * одном условии: псевдоним никогда не возвращается тому, кто его не предъявил.
 *
 * Как только псевдоним попадает в публичное чтение, защита становится
 * ДЕКОРАТИВНОЙ, хотя код проверки на месте и выглядит правильным:
 *
 *   mapReality:  правка сверяет `author_alias !== authorAlias → 403`,
 *                но публичный список делает `SELECT *`, а карточка на сайте
 *                печатает `by {signal.author_alias}` — ключ напечатан на замке;
 *   shadownet:   удаление идёт `WHERE id=$1 AND alias=$2`,
 *                а список постов отдаёт `SELECT id, alias, …`.
 *
 * Для сравнения `lifebox` делает то же самое правильно: список запрашивается ПО
 * псевдониму, а ручка открытия капсулы требует его параметром и сверяет ДО
 * выдачи чего-либо. Наружу псевдоним не уходит никогда.
 *
 * Поэтому правило: сверяешь псевдоним — не отдавай его. Долг зафиксирован
 * поимённо (см. KNOWN_GAP): он не должен ни расти незаметно, ни забыться после
 * погашения.
 */

const ROUTES = join(__dirname, "..", "src", "routes");

/** Признак «псевдоним используется как удостоверение». */
const ALIAS_AUTHZ = /alias\s*!==|alias\s*!=\s*[^=]|AND\s+alias\s*=\s*\$|author_alias\s*!==/i;

/**
 * Признак «псевдоним уходит в выдачу» — смотрит ТОЛЬКО на список колонок,
 * между `SELECT` и `FROM`.
 *
 * Первая версия искала `alias` во всём запросе и дала ложные срабатывания на
 * `lifebox`: там `SELECT * FROM lifebox_capsules WHERE alias = $1` — выборка ПО
 * псевдониму, то есть ровно правильное поведение, обратное утечке. Псевдоним в
 * условии `WHERE` не раскрывает его, а требует; в списке колонок — раскрывает.
 * Разница принципиальная, и признак обязан её видеть.
 */
function selectsAlias(sql: string): boolean {
  for (const m of sql.matchAll(/SELECT\s+([\s\S]*?)\s+FROM\b([\s\S]{0,200})/gi)) {
    const cols = m[1];
    const tail = m[2];
    // Запрос, ОГРАНИЧЕННЫЙ псевдонимом, ничего не раскрывает: его результат уже
    // доступен только тому, кто псевдоним предъявил. Так работает lifebox, и это
    // правильный образец, а не нарушение.
    if (/WHERE[\s\S]{0,120}\balias\b\s*=/i.test(tail)) continue;
    if (/^\s*\*/.test(cols)) return true;
    if (/\balias\b|\bauthor_alias\b/i.test(cols)) return true;
  }
  return false;
}

/**
 * Проверено ЧТЕНИЕМ и безопасно — признак файла этого различить не может.
 *
 * Предел статической проверки: она видит SQL, но не видит, что происходит между
 * запросом и ответом. `lifebox` делает `SELECT * FROM lifebox_capsules WHERE
 * id = $1`, то есть по номеру, а не по псевдониму, — формально под правило
 * попадает. Но эта выборка идёт через `dbFindById`, и КАЖДЫЙ вызывающий сверяет
 * псевдоним до того, как что-либо отдать: `GET /capsules/:id/unlock` требует
 * `?alias=` и возвращает 403 при несовпадении. Наружу псевдоним не уходит.
 *
 * Держим отдельно от KNOWN_GAP намеренно: там долг, который надо погасить, здесь
 * — подтверждённо правильный код. Смешивать нельзя, иначе через месяц никто не
 * вспомнит, что из этого чинить.
 */
const VERIFIED_SAFE: Record<string, string> = {
  "lifebox.ts":
    "проверено чтением 28.07: SELECT * идёт по id через dbFindById, а все вызывающие сверяют псевдоним ДО выдачи (unlock → 403 при несовпадении)",
};

/**
 * Известный ДОЛГ: модуль публикует псевдоним, которым же и защищается.
 *
 * Отличается от «так задумано» тем, что это надо чинить — вопрос лишь в том,
 * КАК (отдельный секрет правки против скрытия псевдонима), и это решение
 * основателя, потому что меняет вид продукта. Ниже отдельная проверка на ТОЧНЫЙ
 * состав списка: появится третий — тест упадёт; закроют существующий — тоже
 * упадёт и потребует убрать запись.
 */
const KNOWN_GAP: Record<string, string> = {
  "qpersona.ts":
    "правка персоны идёт по псевдониму ИЗ АДРЕСА без всякой сверки, секрета у персоны нет вовсе — худший случай из трёх, вынесено основателю 28.07, пункт 13",
  "mapReality.ts":
    "публичный список отдаёт SELECT * с author_alias, карточка печатает «by <псевдоним>» — вынесено основателю 28.07, пункт 13",
  "shadownet.ts":
    "список постов отдаёт SELECT id, alias, … — тот же случай; псевдонимность продукта не требует публикации ключа правки",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

export function findAliasLeaks(files: string[]): {
  offenders: string[];
  usesAlias: number;
  scanned: number;
} {
  const offenders: string[] = [];
  let usesAlias = 0;
  let scanned = 0;
  for (const file of files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    if (!ALIAS_AUTHZ.test(src)) continue;
    usesAlias++;
    if (!selectsAlias(src)) continue;
    offenders.push(file.slice(ROUTES.length + 1).replace(/\\/g, "/"));
  }
  return { offenders, usesAlias, scanned };
}

describe("псевдоним-удостоверение не публикуется", () => {
  const files = walk(ROUTES);

  it("обход нашёл модули, где псевдоним вообще используется как ключ", () => {
    const { usesAlias, scanned } = findAliasLeaks(files);
    expect(scanned, "прочитано слишком мало файлов").toBeGreaterThan(40);
    // На 28.07 таких модулей четыре: lifebox, mapReality, shadownet, qpersona.
    // Ноль означал бы сломанный признак, и тогда «нарушений нет» ничего не значит.
    expect(usesAlias, "не найдено ни одного модуля с псевдонимом-ключом").toBeGreaterThan(2);
  });

  it("новых модулей, публикующих свой ключ, не появилось", () => {
    const { offenders } = findAliasLeaks(files);
    const fresh = offenders.filter((f) => !(f in KNOWN_GAP) && !(f in VERIFIED_SAFE));
    expect(
      fresh,
      `Эти модули сверяют псевдоним для прав И отдают его в публичном чтении — ` +
        `значит защита декоративна:\n  ${fresh.join("\n  ")}\n\n` +
        "Либо не возвращайте псевдоним наружу (как делает lifebox), либо введите " +
        "отдельный секрет правки. Если случай законный — впишите в KNOWN_GAP " +
        "С ПРИЧИНОЙ.",
    ).toEqual([]);
  });

  it("состав известного долга не изменился незаметно", () => {
    const { offenders } = findAliasLeaks(files);
    expect(
      offenders.sort(),
      "Список модулей, публикующих свой ключ, изменился. Погасили — уберите запись " +
        "из KNOWN_GAP. Появился новый — почините или впишите с причиной.",
    ).toEqual([...Object.keys(KNOWN_GAP), ...Object.keys(VERIFIED_SAFE)].sort());
  });

  it("у каждой записи долга есть внятная причина", () => {
    for (const [k, why] of [...Object.entries(KNOWN_GAP), ...Object.entries(VERIFIED_SAFE)]) {
      expect(why.length, `у записи ${k} нет причины`).toBeGreaterThan(30);
    }
  });

  it("сторож ловит нарушение и НЕ ловит правильный модуль", () => {
    // Две фикстуры сразу: одна должна попадать под правило, вторая — нет.
    // Проверять только первую мало: она подтверждает лишь одну сторону.
    const { writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const bad = join(ROUTES, "__fixture_alias_leak.ts");
    const good = join(ROUTES, "__fixture_alias_ok.ts");
    writeFileSync(
      bad,
      'const q = `SELECT id, alias, body FROM t`;\nif (row.alias !== given) return res.status(403);\n',
      "utf8",
    );
    writeFileSync(
      good,
      // Сверяет, но наружу не отдаёт: выборка идёт ПО псевдониму, как в lifebox.
      'const q = `SELECT id, body FROM t WHERE alias = $1`;\nif (row.alias !== given) return res.status(403);\n',
      "utf8",
    );
    try {
      expect(findAliasLeaks([bad]).offenders).toHaveLength(1);
      expect(findAliasLeaks([good]).offenders).toEqual([]);
    } finally {
      rmSync(bad, { force: true });
      rmSync(good, { force: true });
    }
  });
});
