import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Новый обработчик не должен читать карту ПАМЯТИ при живой базе.
 *
 * Класс, найденный 27-28.08.2026 в ЧЕТЫРЁХ платных модулях подряд:
 *
 *   QLearn  $15/мес - курс нельзя было завершить, сертификат получить;
 *   QMedia  $15/мес - база не использовалась ВООБЩЕ, всё терялось при выкатке;
 *   QStore  $15/мес - продавец видел "0 продаж, выручка 0" при настоящих;
 *   QNews    $9/мес - все разделы, лента и сводка показывали ноль.
 *
 * Общее: данные ПИШУТСЯ в базу, а читаются из Map. На проде память пуста
 * после каждой выкатки, и ручка отвечает пустотой - законно на вид.
 *
 * Почему это не ловилось ничем: ни типы, ни обычные тесты этого не видят.
 * Тесты особенно - в них память как раз заполнена, поэтому ручка, читающая
 * память, в тесте работает.
 *
 * Сторож НЕ требует нуля: 15 оставшихся мест перечислены ниже как базовая
 * линия. Требовать их немедленной починки значило бы сделать сторожа вечно
 * красным, а такого отключают целиком. Он ловит ПОПОЛНЕНИЕ списка.
 *
 * Починил место - вычеркни строку отсюда: список должен только сокращаться.
 */

const ROUTES = path.join(__dirname, "..", "src", "routes");

/** Известные места на 28.08.2026. Только сокращать. */
const BASELINE = new Set<string>([
  "qcoreai delete /sessions/:id/collab",
  "qcoreai get /collab/:token",
  "qcoreai post /sessions/:id/collab",
  "qlearn get /me/progress",
  "qreal get /demo",
  "qreal get /projects",
  "qreal get /projects/:id",
  "qreal get /projects/:id/characters",
  "qreal get /projects/:id/estimate",
  "qreal get /projects/:id/provenance",
  "qreal post /projects/:id/continuity",
  "qsocial get /hashtag/:tag",
  "qsocial get /search",
  "qsocial get /trending-tags",
  "qtradeoffline post /sync",
]);

function scan(): string[] {
  const found: string[] = [];
  for (const f of readdirSync(ROUTES).filter((x) => x.endsWith(".ts"))) {
    const mod = f.slice(0, -3);
    const lines = readFileSync(path.join(ROUTES, f), "utf8").split(/\r?\n/);
    const starts: number[] = [];
    lines.forEach((l, i) => {
      if (/^[a-zA-Z_]+\.(get|post|put|patch|delete)\(\s*"/.test(l)) starts.push(i);
    });
    if (starts.length === 0) continue;
    starts.push(lines.length);
    for (let k = 0; k < starts.length - 1; k++) {
      const seg = lines.slice(starts[k], starts[k + 1]);
      // Комментарии выбрасываем: разбор дефекта В КОММЕНТАРИИ не должен
      // считаться самим дефектом - на этом сторожа краснели и раньше.
      const code = seg
        .filter((l) => {
          const t = l.trimStart();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      const readsMemory = /\bmem[A-Z][A-Za-z]*\.(get|set|values|has|delete)\(/.test(code);
      if (!readsMemory) continue;
      // Обработчик СПРАШИВАЕТ хранилище - память тут кэш или запасной путь,
      // а не подмена базы. Именно так устроен DevHub: 35 его обработчиков
      // держат карты рядом со слоем dbGetProject/dbSaveFile и работают верно.
      // Без этого освобождения сторож краснел бы на исправном коде самого
      // дорогого модуля платформы - а краснеющего на верной работе отключают.
      if (code.includes("DbReady()")) continue;
      if (code.includes("pool.query")) continue;
      if (/\b(db[A-Z]|load[A-Z]|save[A-Z]|persist[A-Z])\w*\(/.test(code)) continue;
      const m = /^[a-zA-Z_]+\.([a-z]+)\("([^"]*)"/.exec(lines[starts[k]]);
      if (m) found.push(mod + " " + m[1] + " " + m[2]);
    }
  }
  return [...new Set(found)].sort();
}

describe("новый обработчик не читает память при живой базе", () => {
  test("контроль прибора: он вообще что-то находит", () => {
    // Ноль здесь значил бы, что сторож ослеп, а не что платформа чиста.
    const all = scan();
    expect(all.length, "прибор не нашёл НИ ОДНОГО места - он сломан").toBeGreaterThan(5);
  });

  test("список не пополнился", () => {
    const fresh = scan().filter((x) => !BASELINE.has(x));
    expect(
      fresh,
      "новый обработчик читает карту памяти без проверки живой базы. На проде " +
        "память пуста после каждой выкатки: ответ будет пустым и выглядеть " +
        "законно. Читайте из хранилища, а память оставляйте только под " +
        "isXxxDbReady() - как запасной путь там, где базы нет вовсе.",
    ).toEqual([]);
  });

  test("починенное вычеркнуто из списка", () => {
    // Список обязан только сокращаться. Если строка есть в базовой линии, а
    // в коде места уже нет - её надо убрать, иначе линия перестанет отражать
    // правду и однажды разрешит настоящий дефект.
    const live = new Set(scan());
    const stale = [...BASELINE].filter((x) => !live.has(x));
    expect(stale, "эти места уже починены - вычеркните их из BASELINE").toEqual([]);
  });
});
