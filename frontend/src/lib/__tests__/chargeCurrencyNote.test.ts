import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargeCurrencyNoteKey, shouldWarnAboutCurrency } from "../chargeCurrencyNote";

/**
 * Страница цен говорит правду о валюте списания.
 *
 * На проде PayBox не настроен: тенге мы не принимаем, а цены в ₸ показываем.
 */

describe("что написано под ценой", () => {
  test("доллары — обычная подпись", () => {
    expect(chargeCurrencyNoteKey("USD", true)).toContain("usdNote");
  });

  test("тенге и PayBox работает — обещаем тенге", () => {
    expect(chargeCurrencyNoteKey("KZT", true)).toContain("kztNote");
  });

  test("тенге и PayBox не настроен — честно про доллары", () => {
    expect(chargeCurrencyNoteKey("KZT", false)).toContain("kztFallbackNote");
  });

  test("не спросили — говорим «не знаем», а не «Kaspi не подключён»", () => {
    // Ложное «не подключён» отпугивает покупателя ровно так же, как ложное
    // обещание Kaspi его обманывает: один сетевой сбой — и мы врём.
    expect(chargeCurrencyNoteKey("KZT", null)).toContain("kztUnknownNote");
  });
});

describe("предупреждение перед уходом в кассу", () => {
  test("касса считает в другой валюте — предупреждаем", () => {
    expect(shouldWarnAboutCurrency({ shown: "KZT", fromCheckout: "USD", alreadyWarned: false })).toBe(true);
  });

  test("валюта совпала — не мешаем", () => {
    expect(shouldWarnAboutCurrency({ shown: "USD", fromCheckout: "USD", alreadyWarned: false })).toBe(false);
  });

  test("уже предупредили — второй клик осознанный", () => {
    expect(shouldWarnAboutCurrency({ shown: "KZT", fromCheckout: "USD", alreadyWarned: true })).toBe(false);
  });

  test("касса валюту не прислала — молчим, но это НЕ «совпала»", () => {
    // Поле необязательное: половина пары ещё не выкачена. Отсутствие данных
    // не повод ни предупреждать, ни утверждать, что всё сошлось.
    expect(shouldWarnAboutCurrency({ shown: "KZT", fromCheckout: undefined, alreadyWarned: false })).toBe(false);
    expect(shouldWarnAboutCurrency({ shown: "KZT", fromCheckout: 42, alreadyWarned: false })).toBe(false);
  });
});

describe("заметка видна каждому, а не только по ссылке с ?module=", () => {
  test("подпись стоит вне блока модуля", () => {
    // Это проверка МЕСТА, и она нужна: сама находка была не в тексте, а в том,
    // что текст висел внутри блока, который включается только диплинком.
    const src = readFileSync(
      join(process.cwd(), "src/app/pricing/page.tsx"),
      "utf8",
    );
    const метка = src.indexOf('data-testid="charge-currency-note"');
    const начало = src.indexOf("{heroModule && (() => {");

    expect(метка, "подпись исчезла со страницы").toBeGreaterThan(0);
    expect(начало, "блок модуля не найден — проверка устарела").toBeGreaterThan(0);

    // Границы блока считаются по скобкам, а не по номеру строки: подпись стоит
    // НИЖЕ блока в файле, и сравнение позиций дало бы ложную тревогу.
    let глубина = 0;
    let конец = начало;
    for (let i = начало; i < src.length; i++) {
      if (src[i] === "{") глубина++;
      else if (src[i] === "}") {
        глубина--;
        if (глубина === 0) { конец = i; break; }
      }
    }
    expect(конец, "конец блока не найден").toBeGreaterThan(начало);

    const внутри = метка > начало && метка < конец;
    expect(внутри, "подпись снова внутри блока, доступного только по ?module=").toBe(false);
  });
});
