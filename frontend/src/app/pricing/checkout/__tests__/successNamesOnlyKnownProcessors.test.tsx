import { describe, test, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Страница успеха называет кассу, только если знает её наверняка.
 *
 * Ровно это обещает комментарий рядом с кодом: «Название сервиса пишем, только
 * если знаем его наверняка. Не знаем — строка без названия: выдуманное имя хуже
 * отсутствующего». Обещание не исполнялось для служебных имён.
 *
 * `provider` приходит ИЗ АДРЕСА (`?provider=...`), а поиск шёл прямой
 * индексацией по объекту-справочнику из четырёх касс. Имя `constructor`
 * разрешается в наследство и даёт ФУНКЦИЮ, а она:
 *
 *   - подставляется в строку как «function Object() { [native code] }»;
 *   - рендерится как дочерний узел React, а функция дочерним узлом быть не может.
 *
 * Это страница, на которую человек попадает СРАЗУ ПОСЛЕ ОПЛАТЫ. Цена поломки
 * здесь выше, чем где-либо: деньги уже списаны, а экран сломан.
 */

let query = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/lib/track", () => ({ track: () => {} }));
// Словарь НЕ подменяем: страница берёт тексты через useI18n, и настоящий
// провайдер честнее заглушки — подстановка значения в строку тоже часть
// того, что увидит человек.

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";
// eslint-disable-next-line import/first
import SuccessPage from "../success/page";

beforeEach(() => {
  query = "";
});

const текст = () => {
  const { container } = render(
    <I18nProvider>
      <SuccessPage />
    </I18nProvider>,
  );
  return container.textContent ?? "";
};

describe("страница успеха не выдумывает название кассы", () => {
  test("контроль: известную кассу называет", () => {
    // Иначе «служебное имя не просочилось» могло бы означать «страница пуста».
    query = "provider=paybox&tier=full";
    expect(текст(), "известная касса не названа").toContain("PayBox");
  });

  test("служебное имя не становится названием кассы", () => {
    query = "provider=constructor&tier=full";
    let вышло = "";
    expect(() => {
      вышло = текст();
    }, "страница упала: функция не может быть дочерним узлом React").not.toThrow();
    expect(вышло.toLowerCase(), "в текст просочилось внутреннее значение").not.toContain("native code");
    expect(вышло.toLowerCase(), "в текст просочилось слово function").not.toContain("function object");
  });

  test("наследственное имя тоже не проходит", () => {
    query = "provider=toString&tier=full";
    let вышло = "";
    expect(() => {
      вышло = текст();
    }).not.toThrow();
    expect(вышло.toLowerCase()).not.toContain("native code");
  });
});
