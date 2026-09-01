import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";

/**
 * Храповик: КАЖДАЯ ручка платёжного API отказывает запросу без ключа.
 *
 * ЗАЧЕМ. Ворота (`gateRequest`) стоят первой строкой в каждом обработчике, но
 * ни один тест не звал МАРШРУТ без ключа: единственная проверка отказа —
 * keyShapeIsActuallyChecked — обращается к функции напрямую, минуя маршрут.
 *
 * Замер 01.09.2026: мутация «убрать ворота из POST /links» НЕ ловилась ни
 * одним из 25 файлов набора. То есть ручку можно было открыть настежь, и
 * никакой тест бы не покраснел.
 *
 * Список ручек берётся ПЕРЕЧИСЛЕНИЕМ, но с контролем охвата ниже: добавят
 * десятую и не впишут сюда — контроль покраснеет.
 */
const ручки: Array<[string, string, "GET" | "POST"]> = [
  ["links (чтение)", "links", "GET"],
  ["links (создание)", "links", "POST"],
  ["refunds", "refunds", "POST"],
  ["disputes", "disputes", "GET"],
  ["settlements", "settlements", "GET"],
  ["subscriptions", "subscriptions", "GET"],
  ["webhooks", "webhooks", "GET"],
  ["audit", "audit", "GET"],
  ["checkout", "checkout", "POST"],
];

function безКлюча(путь: string, метод: "GET" | "POST") {
  return new NextRequest(`https://example.test/api/payments/v1/${путь}`, {
    method: метод,
    ...(метод === "POST"
      ? { body: JSON.stringify({}), headers: { "content-type": "application/json" } }
      : {}),
  });
}

describe("без ключа не работает ни одна ручка", () => {
  test.each(ручки)("%s отказывает без ключа", async (_имя, путь, метод) => {
    const модуль = await import(`../${путь}/route`);
    const обработчик = модуль[метод] as ((r: NextRequest) => Promise<Response>) | undefined;

    // Контроль прибора: если обработчика нет, «отказал» было бы бессмыслицей.
    expect(обработчик, `у ручки ${путь} нет обработчика ${метод}`).toBeTypeOf("function");

    const res = await обработчик!(безКлюча(путь, метод));
    expect(
      res.status,
      `ручка ${путь} ${метод} пустила запрос БЕЗ ключа`,
    ).toBe(401);
  });

  test("контроль охвата: проверены все ручки каталога", async () => {
    // Появится десятая — этот контроль покраснеет, и список придётся дополнить.
    const { readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const каталог = join(__dirname, "..");
    const найдено = readdirSync(каталог, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "__tests__")
      .map((d) => d.name)
      .sort();
    const проверено = [...new Set(ручки.map(([, п]) => п))].sort();

    // health отвечает без ключа намеренно: это проба живости.
    const ожидаемо = найдено.filter((и) => и !== "health");
    expect(проверено, "появилась ручка, не покрытая проверкой входа").toEqual(ожидаемо);
  });
});
