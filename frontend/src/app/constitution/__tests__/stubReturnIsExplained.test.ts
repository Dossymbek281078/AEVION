import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Возврат с непройденной оплатой объясняется человеку.
 *
 * Касса «Конституции» при ненастроенном провайдере отвечает честно и уводит
 * покупателя на `/constitution/pricing?stub=1`. Страница этот признак НЕ читала:
 * человек нажимал «Купить», молча оказывался на той же странице и не понимал,
 * что произошло. Нажал бы ещё раз — снова ничего.
 *
 * Такая поломка не падает: ответ 200, страница отрисована, в журналах чисто.
 * Видит её только тот, кто прошёл путь покупателя до конца.
 *
 * Сторож читает исходник: проверить снаружи нельзя, пока провайдер настроен.
 */

const PAGE = join(__dirname, "..", "pricing", "page.tsx");
const src = readFileSync(PAGE, "utf8");

describe("страница цен объясняет возврат без оплаты", () => {
  test("контроль: это нужная страница", () => {
    expect(src.includes("constitution-pricing")).toBe(true);
  });

  test("признак из адреса читается", () => {
    expect(
      src.includes('get("stub")'),
      "страница снова не читает признак — покупатель вернётся молча и без объяснения",
    ).toBe(true);
  });

  test("и он что-то показывает человеку", () => {
    expect(src.includes("payUnavailable ?")).toBe(true);
    // Текст живёт в словаре: страница переведена, и русский литерал в разметке
    // означал бы, что англоязычный посетитель увидит русское. Поэтому сторож
    // проверяет КЛЮЧ, а не фразу.
    expect(
      src.includes('t("constitution.pay.unavailableTitle")'),
      "признак читается, но человеку ничего не сказано",
    ).toBe(true);
  });

  test("сказано, что деньги не списаны — это первый вопрос человека", () => {
    const dict = readdirSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang", f), "utf8"))
      .join(" ");
    expect(src.includes('t("constitution.pay.unavailableBody")')).toBe(true);
    expect(dict.includes("деньги не списаны")).toBe(true);
    expect(dict.includes("nothing was charged")).toBe(true);
  });
});
