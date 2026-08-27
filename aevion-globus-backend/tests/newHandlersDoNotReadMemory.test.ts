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
 * Сторож НЕ требует нуля: существующие места перечислены ниже как базовая
 * линия. Требовать их немедленной починки значило бы сделать сторожа вечно
 * красным, а такого отключают целиком. Он ловит ПОПОЛНЕНИЕ списка.
 *
 * Починил место - вычеркни строку отсюда: список должен только сокращаться.
 */

const ROUTES = path.join(__dirname, "..", "src", "routes");

/** Известные места на 28.08.2026. Только сокращать. */
const BASELINE = new Set<string>([
  "devhub delete /projects/:id",
  "devhub delete /projects/:id/collaborators/:collabUserId",
  "devhub delete /projects/:id/database",
  "devhub delete /projects/:id/env/:key",
  "devhub delete /projects/:id/file",
  "devhub delete /projects/:id/files/:filepath",
  "devhub delete /snippets/:id",
  "devhub get /projects",
  "devhub get /projects/:id/file-binary",
  "devhub get /projects/:id/files",
  "devhub get /projects/:id/preview-proxy",
  "devhub get /snippets",
  "devhub get /snippets/:id",
  "devhub patch /projects/:id",
  "devhub post /plan",
  "devhub post /projects",
  "devhub post /projects/:id/apply-template",
  "devhub post /projects/:id/database/provision",
  "devhub post /projects/:id/deploy",
  "devhub post /projects/:id/deploy/pages",
  "devhub post /projects/:id/deploy/vercel",
  "devhub post /projects/:id/domain",
  "devhub post /projects/:id/domain/setup",
  "devhub post /projects/:id/drive/import",
  "devhub post /projects/:id/files/translate",
  "devhub post /projects/:id/files/translate-bulk",
  "devhub post /projects/:id/generate",
  "devhub post /projects/:id/github/push",
  "devhub post /projects/:id/github/sync",
  "devhub post /projects/:id/import-zip",
  "devhub post /snippets",
  "devhub post /snippets/:id/star",
  "devhub put /projects/:id/env",
  "devhub put /projects/:id/file",
  "devhub put /projects/:id/files/:filepath",
  "qcoreai delete /sessions/:id/collab",
  "qcoreai get /collab/:token",
  "qcoreai post /sessions/:id/collab",
  "qlearn get /me/progress",
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
  "qreal post /projects/:id/continuity",
  "qreal post /projects/:id/register",
  "qreal post /projects/:id/render-all",
  "qreal post /projects/:id/shots/:sid/qc",
  "qreal post /projects/:id/shots/:sid/render",
  "qreal post /projects/:id/storyboard",
  "qsocial get /hashtag/:tag",
  "qsocial get /search",
  "qsocial get /trending-tags",
  "qtradeoffline get /leaderboard",
  "qtradeoffline get /stats",
  "qtradeoffline get /wallet/:id",
  "qtradeoffline post /sync",
  "qtradeoffline post /wallet/register",
  "ventures post /ideas/:id/interest",
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
      // Защита есть - память тут законный запасной путь на случай, когда базы нет вовсе.
      if (code.includes("DbReady()")) continue;
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
    expect(all.length, "прибор не нашёл НИ ОДНОГО места - он сломан").toBeGreaterThan(10);
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
