import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * До подключения покупки можно дойти, и экран не врёт об успехе.
 *
 * Ручки связывания были написаны раньше страницы, и без неё они работали
 * вхолостую: письма после оплаты мы не шлём, магазин про нас не знает, а
 * значит человеку неоткуда узнать адрес. Механизм, до которого нельзя
 * дойти, снаружи неотличим от отсутствующего.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const PAGE = path.resolve(HERE, "..", "page.tsx");
const LINK = path.resolve(HERE, "..", "link", "page.tsx");
const I18N = path.resolve(HERE, "..", "i18n.ts");
const P = fs.readFileSync(PAGE, "utf8");
const L = fs.readFileSync(LINK, "utf8");
const T = fs.readFileSync(I18N, "utf8");

describe("подключение покупки доступно человеку", () => {
  it("контроль: все три файла прочитаны и это они", () => {
    expect(P.length, "страница модуля не прочитана").toBeGreaterThan(5000);
    expect(L.length, "страница подключения не прочитана").toBeGreaterThan(1000);
    expect(T.length, "словарь не прочитан").toBeGreaterThan(1000);
    expect(L, "читается не та страница").toContain("guest/link-confirm");
  });

  it("со страницы модуля есть путь к подключению", () => {
    expect(
      P,
      "ссылки на /devhub/link нет: ручки связывания работают, а дойти до них " +
        "неоткуда — письма после оплаты мы не шлём",
    ).toContain('href="/devhub/link"');
  });

  it("экран зовёт обе ручки", () => {
    expect(L, "нет запроса ссылки").toContain("guest/link-request");
    expect(L, "нет подтверждения").toContain("guest/link-confirm");
  });

  it("успех определяется ответом, а не фактом запроса", () => {
    // fetch не бросает на 400 и 503. Безусловное «готово» после запроса —
    // отказ, выглядящий как успех: самый дорогой класс на денежном пути.
    const okChecks = (L.match(/r\.ok/g) || []).length;
    expect(okChecks, "код ответа не проверяется ни разу").toBeGreaterThanOrEqual(2);
    // НЕ «слово есть в файле»: первая редакция пережила мутацию, где отказ
    // убрали из ОДНОЙ ветки, а во второй он остался. Путей отказа два —
    // плохой ответ сервера и обрыв связи — и оба обязаны быть видны человеку.
    const marks = (L.match(/setFailed\(true\)/g) || []).length;
    expect(
      marks,
      "отказ помечается меньше чем на двух путях: один из них молча выглядит " +
        "как успех (плохой ответ сервера и обрыв связи — разные пути)",
    ).toBeGreaterThanOrEqual(2);
  });

  it("тексты есть во всех трёх языках", () => {
    for (const key of ["link.title", "link.sent", "pro.linkPurchase"]) {
      const n = T.split('' + key + '').length - 1;
      expect(n, "ключ " + key + " переведён не во всех языках: найдено " + n).toBeGreaterThanOrEqual(3);
    }
  });
});
