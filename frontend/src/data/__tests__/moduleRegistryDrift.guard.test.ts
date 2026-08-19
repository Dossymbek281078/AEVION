import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Списки модулей расходятся молча — этот страж делает расхождение шумным.
 *
 * У платформы три независимых списка того, что у неё есть:
 *   1. каталог проектов  — aevion-globus-backend/src/data/projects.ts (/api/aevion/catalog)
 *   2. витрина модулей   — frontend/src/app/explore/page.tsx (REGIONS)
 *   3. товары            — frontend/src/lib/products.ts
 *
 * Они не совпадают. DevHub продаётся и открыт на /devhub, но в каталоге его
 * нет вовсе: купивший не найдёт продукт в каталоге платформы, а публичный
 * счётчик «живых модулей» его не считает. IP Bureau и вовсе живёт под двумя
 * идентификаторами сразу — `bureau` на витрине, `aevion-ip-bureau` в каталоге.
 *
 * Свести списки в один источник — отдельная работа, и она меняет ПУБЛИЧНЫЕ
 * числа (сколько у платформы модулей и сколько из них живых), поэтому решается
 * не тестом. Что тест может сделать сегодня — зафиксировать текущее
 * расхождение поимённо и не дать ему тихо вырасти. Новый модуль, добавленный
 * в один список и забытый в другом, теперь красит сборку.
 *
 * Как чинить падение: либо добавить модуль во второй список, либо, если
 * расхождение осознанное, вписать его сюда с объяснением — но именно вписать,
 * а не расширить общим правилом.
 */

const CATALOG = resolve(__dirname, "../../../../aevion-globus-backend/src/data/projects.ts");
const EXPLORE = resolve(__dirname, "../../app/explore/page.tsx");

/** Есть на витрине, нет в каталоге. Замер 28.07.2026. */
const SHOWN_BUT_NOT_CATALOGUED = [
  // Продаются и открыты, но в каталог не попали — это пропуск, а не решение.
  "devhub",
  "bank",
  "qpaynet",
  "qtrade",
  // Здоровье: живут как отдельные страницы, в каталоге проектов их нет.
  "longevity",
  "qmelanin",
  "qrenew",
  // Тот же модуль, что `aevion-ip-bureau` в каталоге, но под другим id.
  "bureau",
];

/**
 * Обратная сторона: есть в каталоге, не показаны на витрине. Здесь список не
 * поимённый — их 19, и большинство осознанно не вынесено на витрину (внутренняя
 * механика, материалы). Сторожим только рост числа: если завтра забудут вынести
 * ещё один модуль, счётчик это покажет.
 */
const CATALOGUED_NOT_SHOWN_MAX = 19;

function ids(file: string, pattern: RegExp): Set<string> {
  const src = readFileSync(file, "utf8");
  return new Set([...src.matchAll(pattern)].map((m) => m[1]));
}

describe("списки модулей не расходятся молча", () => {
  it("оба источника на месте", () => {
    // Без этой проверки исчезнувший файл дал бы пустые множества и зелёный
    // тест на пустом месте.
    expect(existsSync(CATALOG), `нет каталога: ${CATALOG}`).toBe(true);
    expect(existsSync(EXPLORE), `нет витрины: ${EXPLORE}`).toBe(true);
  });

  it("на витрине не появилось новых модулей, которых нет в каталоге", () => {
    const catalog = ids(CATALOG, /\bid:\s*"([^"]+)"/g);
    const explore = ids(EXPLORE, /\bslug:\s*"([^"]+)"/g);
    expect(catalog.size, "каталог не разобрался").toBeGreaterThan(30);
    expect(explore.size, "витрина не разобралась").toBeGreaterThan(20);

    const known = new Set(SHOWN_BUT_NOT_CATALOGUED);
    const fresh = [...explore].filter((s) => !catalog.has(s) && !known.has(s));

    expect(
      fresh.sort(),
      "Модуль показан на /explore, но отсутствует в каталоге проектов:\n" +
        fresh.join(", ") +
        "\nЛибо добавьте его в projects.ts, либо впишите в SHOWN_BUT_NOT_CATALOGUED с причиной.",
    ).toEqual([]);
  });

  it("число невынесенных на витрину модулей не растёт", () => {
    const catalog = ids(CATALOG, /\bid:\s*"([^"]+)"/g);
    const explore = ids(EXPLORE, /\bslug:\s*"([^"]+)"/g);
    const hidden = [...catalog].filter((id) => !explore.has(id));

    expect(
      hidden.length,
      `Модулей в каталоге, но не на витрине: ${hidden.length} (было ${CATALOGUED_NOT_SHOWN_MAX}).\n` +
        hidden.sort().join(", "),
    ).toBeLessThanOrEqual(CATALOGUED_NOT_SHOWN_MAX);
  });
});
