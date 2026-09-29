import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentReachNotice } from "@/components/PaymentReachNotice";

/**
 * Сторож: предупреждение о способах оплаты доходит до ЭКРАНА.
 *
 * Рядом уже стоит everySellingPageWarnsAboutPayment — он читает ИСХОДНИК и
 * следит, чтобы ни одна продающая страница не молчала. Этого мало: исходник
 * может содержать компонент, который ничего не рисует (пустая строка перевода,
 * условие, возврат null). Замер 28.08.2026 научил различать «есть в коде» и
 * «видно человеку» — тогда трижды за день вывод о том, что видит посетитель,
 * был сделан по коду и трижды оказался неверным.
 *
 * Поэтому здесь проверяется отрисовка, и с двусторонним контролем по языку:
 * русская и английская строки не должны совпадать, иначе «перевод есть»
 * означало бы лишь «функция вернула хоть что-то».
 */
describe("строка о способах оплаты", () => {
  test("рисуется непустым текстом", () => {
    const { container } = render(<PaymentReachNotice />);
    const текст = (container.textContent ?? "").trim();
    expect(текст.length, "компонент есть в коде, но на экране пусто").toBeGreaterThan(20);
  });

  test("называет карту как способ оплаты", () => {
    render(<PaymentReachNotice />);
    const текст = (document.body.textContent ?? "").toLowerCase();
    expect(текст, "строка не говорит, чем платят").toMatch(/карт|card/);
  });

  test("КОНТРОЛЬ: английская строка отличается от русской", () => {
    const ru = render(<PaymentReachNotice lang="ru" />).container.textContent ?? "";
    const en = render(<PaymentReachNotice lang="en" />).container.textContent ?? "";
    expect(ru.trim().length).toBeGreaterThan(20);
    expect(en.trim().length).toBeGreaterThan(20);
    expect(en, "английская страница получила русскую строку — перевод не подключён").not.toBe(ru);
  });
});
