import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Новый обработчик не должен подменять базу картой в ПАМЯТИ.
 *
 * Класс, найденный 27-28.08.2026 в ЧЕТЫРЁХ платных модулях подряд:
 *
 *   QLearn  $15/мес - курс нельзя было завершить и получить сертификат;
 *   QMedia  $15/мес - база не использовалась ВООБЩЕ, всё терялось при выкатке;
 *   QStore  $15/мес - продавец видел "0 продаж, выручка 0" при настоящих;
 *   QNews    $9/мес - разделы, лента и сводка показывали ноль.
 *
 * Общее: данные ПИШУТСЯ в базу, а читаются из Map. На проде память пуста
 * после каждой выкатки, и ручка отвечает пустотой - законно на вид.
 *
 * Почему не ловилось ничем: ни типы, ни обычные тесты этого не видят. Тесты
 * особенно - в них память как раз заполнена, поэтому ручка, читающая память,
 * в тесте работает.
 *
 * ЧТО СЧИТАЕТСЯ ЗАКОННЫМ. Память рядом с базой - нормальный кэш и нормальный
 * запасной путь. Поэтому обработчик пропускается, если он спрашивает
 * хранилище: напрямую, под isXxxDbReady(), или ЧЕРЕЗ ПОСРЕДНИКА - функцию
 * этого же файла либо импорт из lib, внутри которых есть обращение к базе.
 *
 * Посредник тут не мелочь. Правило "имя начинается с db" сначала казалось
 * достаточным, и по нему сторож краснел бы на исправном коде: у QLearn слой
 * зовётся myEnrollments/certsByUser, у DevHub - dbGetProject. Сторож,
 * краснеющий на верной работе, отключают целиком, и защиты не остаётся.
 *
 * Сторож НЕ требует нуля: оставшиеся места перечислены ниже как базовая линия,
 * краснеет он на ПОПОЛНЕНИЕ. Починил место - вычеркни строку: список обязан
 * только сокращаться.
 */

const SRC = path.join(__dirname, "..", "src");
const ROUTES = path.join(SRC, "routes");
const LIB = path.join(SRC, "lib");

/** Оставшийся долг на 28.08.2026. Только сокращать. */
const BASELINE = new Set<string>([
  "qcoreai delete /sessions/:id/collab",
  "qcoreai get /collab/:token",
  "qcoreai post /sessions/:id/collab",
  "qreal get /demo",
  "qreal get /projects",
  "qreal get /projects/:id",
  "qreal get /projects/:id/characters",
  "qreal get /projects/:id/estimate",
  "qreal get /projects/:id/film",
  "qreal get /projects/:id/provenance",
  "qreal get /projects/:id/shots/:sid/render-status",
  "qreal patch /projects/:id/characters/:cid",
  "qreal post /projects",
  "qreal post /projects/:id/assemble",
  "qsocial get /hashtag/:tag",
  "qsocial get /search",
  "qsocial get /trending-tags",
]);

/** lib-модули, которые сами ходят в базу: импорт из них считается обращением. */
function libsThatQuery(): Set<string> {
  const s = new Set<string>();
  for (const f of readdirSync(LIB).filter((x) => x.endsWith(".ts"))) {
    if (readFileSync(path.join(LIB, f), "utf8").includes("pool.query")) s.add(f.slice(0, -3));
  }
  return s;
}

/** Имена, вызов которых означает "спросили хранилище". */
function storageNames(src: string, libs: Set<string>): string[] {
  const names = new Set<string>();
  const lines = src.split(/\r?\n/);
  const heads: Array<[number, string]> = [];
  lines.forEach((l, i) => {
    const m = /^(?:async function|function|const)\s+([A-Za-z_]\w*)/.exec(l);
    if (m) heads.push([i, m[1]]);
  });
  for (let k = 0; k < heads.length; k++) {
    const end = k + 1 < heads.length ? heads[k + 1][0] : lines.length;
    if (lines.slice(heads[k][0], end).join("\n").includes("pool.query")) names.add(heads[k][1]);
  }
  const imp = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/lib\/([A-Za-z]+)"/g;
  for (let m = imp.exec(src); m; m = imp.exec(src)) {
    if (!libs.has(m[2])) continue;
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(" as ").pop()!.trim();
      if (n) names.add(n);
    }
  }
  return [...names];
}

function scan(): string[] {
  const libs = libsThatQuery();
  const found: string[] = [];
  for (const f of readdirSync(ROUTES).filter((x) => x.endsWith(".ts"))) {
    const mod = f.slice(0, -3);
    const src = readFileSync(path.join(ROUTES, f), "utf8");
    const lines = src.split(/\r?\n/);
    const store = storageNames(src, libs);
    const starts: number[] = [];
    lines.forEach((l, i) => {
      if (/^[a-zA-Z_]+\.(get|post|put|patch|delete)\(\s*"/.test(l)) starts.push(i);
    });
    if (starts.length === 0) continue;
    starts.push(lines.length);
    for (let k = 0; k < starts.length - 1; k++) {
      // Комментарии выбрасываем: разбор дефекта В КОММЕНТАРИИ не есть дефект -
      // на этом сторожа краснели ложно и раньше.
      const code = lines
        .slice(starts[k], starts[k + 1])
        .filter((l) => {
          const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      if (!/\bmem[A-Z][A-Za-z]*\.(get|set|values|has|delete)\(/.test(code)) continue;
      if (code.includes("DbReady()") || code.includes("pool.query")) continue;
      if (store.some((n) => new RegExp("\\b" + n + "\\s*\\(").test(code))) continue;
      const m = /^[a-zA-Z_]+\.([a-z]+)\("([^"]*)"/.exec(lines[starts[k]]);
      if (m) found.push(mod + " " + m[1] + " " + m[2]);
    }
  }
  return [...new Set(found)].sort();
}

describe("новый обработчик не подменяет базу памятью", () => {
  test("контроль прибора: он видит слой хранения и всё же что-то находит", () => {
    // Ноль тут значил бы, что сторож ослеп, а не что платформа чиста.
    expect(libsThatQuery().size, "не нашёл ни одного lib-модуля с запросами").toBeGreaterThan(3);
    expect(scan().length, "прибор не нашёл НИ ОДНОГО места - он сломан").toBeGreaterThan(5);
  });

  test("список не пополнился", () => {
    const fresh = scan().filter((x) => !BASELINE.has(x));
    expect(
      fresh,
      "новый обработчик читает карту памяти и НИ РАЗУ не спрашивает хранилище. " +
        "На проде память пуста после каждой выкатки: ответ будет пустым и " +
        "выглядеть законно. Читайте из базы - напрямую, через слой этого файла " +
        "или через lib; память оставляйте кэшем или запасным путём под " +
        "isXxxDbReady().",
    ).toEqual([]);
  });

  test("починенное вычеркнуто из списка", () => {
    // Линия обязана только сокращаться: строка, которой в коде уже нет,
    // перестаёт отражать правду и однажды разрешит настоящий дефект.
    const live = new Set(scan());
    const stale = [...BASELINE].filter((x) => !live.has(x));
    expect(stale, "эти места уже починены - вычеркните их из BASELINE").toEqual([]);
  });
});
