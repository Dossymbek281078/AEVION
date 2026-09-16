import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pricing from "./__fixtures__/pricing.json";

/**
 * Цена, которую человек видит у покупки, и то, что уходит в кассу, — ОДНА пара.
 *
 * ИСТОРИЯ. 02.09.2026 на `/pricing` три набора показывали цену и кнопку
 * «Get Access →», а кнопка вела не туда:
 *
 *     IP Suite        $29/мес   →  AEVION All-Access $59/мес
 *     AI Suite        $33/мес   →  то же
 *     Fintech Suite   $39/мес   →  то же
 *
 * Своей кассы у наборов не было нигде: ссылка строилась как
 * `gumroadCheckoutUrl({ key: b.id })`, а неизвестный ключ отдавал товар ПО
 * УМОЛЧАНИЮ. Цена приходила из `/api/pricing`, ссылка — из карты пермалинков, и
 * сойтись они не были обязаны ничем.
 *
 * 15.09.2026 основатель снял наборы вместе с All-Access. Их место на странице
 * заняли пять отдельных приложений, и класс остался тем же: цена на карточке и
 * покупка по кнопке должны быть связаны, а не совпадать случайно. Поэтому
 * сторож не удалён, а переведён на новое:
 *
 *   1. наборов нет ни в ответе бэкенда, ни на странице — вернуть их молча нельзя;
 *   2. цена приложения на карточке и тело запроса в кассу строятся из ОДНОЙ
 *      пары «срок + приложение».
 *
 * ГРАНИЦА. Пункт 2 проверяется по ИСХОДНИКУ страницы. Поведение (что именно
 * уходит в кассу по нажатию) закрыто отрисовкой в
 * `unsellableTierExplainsItself.test.tsx`, а равенство копии цен и бэкенда —
 * `lib/__tests__/termPricingMatchesBackend.test.ts`. Здесь — то, чего не видят оба.
 */

const СТРАНИЦА = join(__dirname, "..", "page.tsx");
const БЭКЕНД = join(__dirname, "..", "..", "..", "..", "..", "aevion-globus-backend", "src", "data", "pricing.ts");

/** Строки кода без комментариев: история наборов в комментариях не должна краснеть. */
function кодом(src: string): string {
  return src
    .split(String.fromCharCode(10))
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("{/*");
    })
    .join(String.fromCharCode(10));
}

describe("наборы сняты и не вернулись без своей кассы", () => {
  test("контроль: страница и бэкенд прочитаны", () => {
    const страница = readFileSync(СТРАНИЦА, "utf8");
    const бэкенд = readFileSync(БЭКЕНД, "utf8");
    expect(страница.length, "страница подозрительно короткая").toBeGreaterThan(5000);
    expect(бэкенд.indexOf("export const BUNDLES"), "в бэкенде нет объявления BUNDLES — сторож смотрит не туда").toBeGreaterThan(-1);
  });

  test("бэкенд наборов не отдаёт", () => {
    const бэкенд = readFileSync(БЭКЕНД, "utf8");
    expect(
      /export const BUNDLES[^=]*=\s*\[\s*\]/.test(бэкенд),
      "в BUNDLES снова есть наборы — у них нет своей кассы, и кнопка набора поведёт в чужой товар",
    ).toBe(true);
  });

  test("страница наборы не рисует и в кассу по ключу набора не ведёт", () => {
    const код = кодом(readFileSync(СТРАНИЦА, "utf8"));
    expect(код.includes("data.bundles"), "страница снова рисует наборы").toBe(false);
    expect(
      код.includes("gumroadCheckoutUrl("),
      "страница снова строит ссылку кассы по ключу — неизвестный ключ отдаёт товар по умолчанию",
    ).toBe(false);
  });

  test("снимок ответа, на котором отрисовываются тесты страницы, тоже без наборов", () => {
    // Иначе отрисовочные тесты проверяли бы страницу на данных, которых прод не отдаёт.
    expect((pricing as { bundles?: unknown[] }).bundles ?? []).toEqual([]);
  });
});

describe("цена приложения и покупка — одна пара «срок + приложение»", () => {
  const код = кодом(readFileSync(СТРАНИЦА, "utf8"));

  test("цена на карточке считается от выбранного срока и базы приложения", () => {
    expect(код).toContain("termPricePerMonth(a.baseMonthly, appTerm)");
    expect(код).toContain("termTotal(a.baseMonthly, appTerm)");
  });

  test("в кассу уходят тот же срок и то же приложение", () => {
    expect(
      код.includes("startCheckout({ tierId: appTerm, app: a.slug"),
      "кнопка приложения шлёт в кассу не ту пару, от которой посчитана цена на карточке",
    ).toBe(true);
  });

  test("продаваемость проверяется по ссылке той же пары", () => {
    // Иначе кнопка была бы живой по одной ссылке, а покупка шла бы по другой.
    expect(код).toContain("ссылкаПриложения(a.slug, appTerm)");
  });
});
