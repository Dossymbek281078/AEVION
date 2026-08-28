import { describe, test, expect } from "vitest";
import { queryIsoTimestamp } from "../src/lib/queryNumber";

/**
 * Курсор `?before=` уходит в SQL как сравнение со временем.
 *
 * Замер 21.08.2026: три ручки qpaynet клали параметр в запрос без единой
 * проверки формата — `created_at < $n`. Postgres на «zzz» отвечает ошибкой
 * разбора, наружу уходит 500. Это ошибка КЛИЕНТА: 5xx поднимает людей и копится
 * в наблюдении, среди которого потом не видно настоящих аварий (правило 15г).
 *
 * Отдельно про Date.parse: одного его мало. `Date.parse("1")` возвращает
 * 2000-12-31 — «проверка» пропустила бы курсор, которого пользователь не писал,
 * и выдача молча съехала бы на четверть века. Поэтому форма требуется явно.
 */

describe("queryIsoTimestamp", () => {
  test("настоящая дата проходит и нормализуется", () => {
    expect(queryIsoTimestamp("2026-08-21")).toBe("2026-08-21T00:00:00.000Z");
    expect(queryIsoTimestamp("2026-08-21T10:00:00Z")).toBe("2026-08-21T10:00:00.000Z");
    expect(queryIsoTimestamp("  2026-08-21  ")).toBe("2026-08-21T00:00:00.000Z");
  });

  test("мусор не проходит", () => {
    for (const bad of ["zzz", "", "   ", "2026-13-45", "'; DROP--", "null", "0"]) {
      expect(queryIsoTimestamp(bad), `пропущено: ${bad}`).toBeNull();
    }
  });

  test("контроль: Date.parse В ОДИНОЧКУ пропустил бы «1»", () => {
    // Тот самый случай, ради которого добавлена проверка формы.
    expect(Number.isFinite(Date.parse("1"))).toBe(true);
    expect(queryIsoTimestamp("1")).toBeNull();
  });

  test("не-строки и массивы", () => {
    expect(queryIsoTimestamp(undefined)).toBeNull();
    expect(queryIsoTimestamp(12345)).toBeNull();
    expect(queryIsoTimestamp(["2026-08-21"])).toBe("2026-08-21T00:00:00.000Z");
  });
});

describe("сторож: курсор не уходит в SQL без проверки", () => {
  test("во всех местах, где before кладётся в параметры запроса", async () => {
    const { stripComments } = await import("./helpers/sourceCode");
    const src = stripComments(
      require("node:fs").readFileSync(
        require("node:path").join(__dirname, "..", "src", "routes", "qpaynet.ts"),
        "utf8",
      ),
    );
    // Контроль: файл прочитан и курсор в нём действительно есть.
    expect(src).toContain("req.query.before");
    // Сырое значение больше не должно попадать в params напрямую.
    expect(src, "сырой параметр снова уходит в запрос").not.toMatch(
      /params\.push\(beforeRaw\)/,
    );
    expect(src, "проверка формата пропала").toContain("queryIsoTimestamp");
    expect(src, "нет отказа 400 на неверный формат").toContain("invalid_before");
  });
});
