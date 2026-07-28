import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Обработчик публичной ручки не выбирает колонку, в имени которой есть «private».
 *
 * ЗАЧЕМ. 28.07 в `GET /api/planet/artifacts/:id/public` — открытой без
 * аутентификации — стояло `SELECT * FROM "PlanetCertificate"`, и наружу уходила
 * колонка `privatePayloadJson`, название которой прямо говорит, что этого делать
 * нельзя. Внутри неё `signaturePayload` — точные байты, по которым считается
 * подпись сертификата. Замер живого прода: в ответе 17 полей против 12 в
 * `CREATE TABLE`, потому что звёздочка подхватывала и колонки, добавленные
 * поздними миграциями.
 *
 * Звёздочку закрывает соседний сторож `selectStarOnSensitiveTables`. Здесь
 * закрывается вторая половина: перечислить колонки явно И вписать среди них
 * приватную. Тогда первый сторож молчит, а утечка возвращается.
 *
 * ПОЧЕМУ ПРАВИЛО УЗКОЕ. Проверяется только «private» в имени — признак
 * однозначный, автор колонки уже сказал им всё, что нужно. Более широкие
 * варианты (`ownerId`, `userId`, почта) дали бы ложные срабатывания: их законно
 * выбирают ДЛЯ ПРОВЕРКИ ПРАВ, не отдавая наружу. Живой пример проверен вручную —
 * `quantum-shield /:id/public` выбирает `ownerUserId`, сравнивает с `auth.sub` и
 * возвращает его ТОЛЬКО владельцу. Сторож, требующий переписать такой код, хуже
 * отсутствующего: он учит игнорировать красноту.
 *
 * Правило целиком, вместе с итогами аудита 19 публичных ручек, —
 * `docs/PUBLIC-ENDPOINTS.md`.
 */

const ROUTES = join(__dirname, "..", "src", "routes");

/** Осознанные исключения — каждое с причиной. */
const ALLOWED: Array<{ file: string; fragment: string; reason: string }> = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Тело обработчика от объявления маршрута до балансировки скобок.
 * Возвращает и число разобранных обработчиков — иначе «нарушений нет» было бы
 * неотличимо от «ничего не разобрали» (класс, который сегодня уже дал зелёный
 * сторож при нуле проверенных файлов).
 */
export function scanPublicHandlers(files: string[]): {
  violations: string[];
  handlers: number;
  scanned: number;
} {
  const violations: string[] = [];
  let handlers = 0;
  let scanned = 0;
  const ROUTE_DECL = /(\w+)\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g;

  for (const file of files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    const rel = file.slice(ROUTES.length + 1).replace(/\\/g, "/");
    for (const m of src.matchAll(ROUTE_DECL)) {
      const path = m[3];
      // «Публичной» считаем ручку, у которой это сказано в пути. Роутеры,
      // смонтированные как публичные целиком (multichatPublicRouter,
      // constitutionPublicRouter), ловим по имени переменной.
      const byPath = /public/i.test(path);
      const byRouter = /PublicRouter$/.test(m[1]);
      if (!byPath && !byRouter) continue;
      handlers++;

      // Границы обработчика — балансировкой круглых скобок от объявления.
      let depth = 1;
      let i = src.indexOf("(", m.index! + m[1].length) + 1;
      for (; i < src.length && depth > 0; i++) {
        const ch = src[i];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (depth !== 0) continue; // незакрытый вызов — не наше дело
      const body = src.slice(m.index!, i);

      for (const hit of body.matchAll(/"?(\w*[Pp]rivate\w*)"?/g)) {
        const name = hit[1];
        // Слово «private» в комментарии или в имени функции — не выборка колонки.
        // Признак колонки: имя в кавычках внутри SQL-строки.
        if (!new RegExp('"' + name + '"').test(body)) continue;
        if (ALLOWED.some((a) => a.file === rel && a.fragment === name)) continue;
        const line = src.slice(0, m.index!).split("\n").length;
        violations.push(`${rel}:${line}  ручка «${path}» выбирает «${name}»`);
      }
    }
  }
  return { violations: [...new Set(violations)], handlers, scanned };
}

describe("публичные ручки не выбирают приватные колонки", () => {
  const files = walk(ROUTES);

  it("обход нашёл файлы и публичные ручки — иначе проверка молча пуста", () => {
    const { handlers, scanned } = scanPublicHandlers(files);
    expect(scanned, "файлов роутов прочитано слишком мало").toBeGreaterThan(40);
    // На 28.07 публичных ручек по этому признаку 14. Порог с запасом вниз, но не
    // нулевой: если разбор объявлений сломается, тест обязан упасть, а не
    // отрапортовать «нарушений нет».
    expect(handlers, "не найдено ни одной публичной ручки — сломан разбор объявлений").toBeGreaterThan(5);
  });

  it("ни одна публичная ручка не выбирает колонку со словом private", () => {
    const { violations } = scanPublicHandlers(files);
    expect(
      violations,
      `Публичная ручка выбирает приватную колонку:\n  ${violations.join("\n  ")}\n\n` +
        "Уберите её из перечня колонок. Если случай законный — впишите в ALLOWED " +
        "в этом файле С ПРИЧИНОЙ. Именно так 28.07 наружу уходил " +
        "privatePayloadJson сертификата Planet.",
    ).toEqual([]);
  });

  it("сторож ловит нарушение (негативная проверка)", () => {
    // Без этого «нарушений нет» могло бы означать нерабочую регулярку.
    const tmp = join(__dirname, "__fixture_private_col.ts");
    const { writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    writeFileSync(
      tmp,
      'r.get("/artifacts/:id/public", async (req, res) => {\n' +
        '  const q = await pool.query(`SELECT "id","privatePayloadJson" FROM "PlanetCertificate"`);\n' +
        "  res.json(q.rows[0]);\n});\n",
      "utf8",
    );
    try {
      const { violations, handlers } = scanPublicHandlers([tmp]);
      expect(handlers).toBe(1);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("privatePayloadJson");
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  it("точечно: сертификат в публичной ручке артефакта отдаётся перечнем колонок", () => {
    // Прямая защита правки от 28.07: раньше здесь была звёздочка. Проверяем не
    // отсутствие звёздочки (это делает соседний сторож), а НАЛИЧИЕ ожидаемых
    // колонок и отсутствие двух конкретных — то есть смысл, а не форму.
    const src = readFileSync(join(ROUTES, "planetCompliance.ts"), "utf8");
    const at = src.indexOf('FROM "PlanetCertificate" WHERE "id"=$1');
    expect(at, "запрос сертификата в публичной ручке не найден").toBeGreaterThan(0);
    const query = src.slice(Math.max(0, at - 400), at);
    expect(query).toContain('"publicPayloadJson"');
    expect(query).toContain('"signature"');
    expect(query).not.toContain('"privatePayloadJson"');
    expect(query).not.toContain('"ownerId"');
    expect(query).not.toContain('"revokedBy"');
  });
});
