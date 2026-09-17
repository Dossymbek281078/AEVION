import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProductNotice } from "../ProductNotice";
import { MODULE_NOTICES, productById, productNotice } from "@/lib/products";

/*
 * 15.09.2026: QPayNet и QContract сняты с отдельной продажи — карточек в каталоге
 * у них больше нет, а оговорка на странице модуля нужна по-прежнему. Она живёт в
 * MODULE_NOTICES, и компонент обязан показывать её так же дословно.
 */
describe("оговорка продукта берётся из каталога", () => {
  test("контроль: у qpaynet оговорка есть, хотя карточки на продажу нет", () => {
    // Иначе «компонент её показывает» могло бы означать «показывать нечего».
    expect(productById("qpaynet"), "qpaynet снова продаётся отдельно — политика 15.09.2026").toBeUndefined();
    expect(productNotice("qpaynet"), "оговорка исчезла вместе с карточкой").toBeTruthy();
    expect(MODULE_NOTICES.qcontract, "оговорка qcontract исчезла").toBeTruthy();
  });

  test("текст на экране совпадает с каталогом дословно", () => {
    const ожидаемо = productNotice("qpaynet")!;
    const { container } = render(<ProductNotice productId="qpaynet" />);
    expect(container.textContent, "на экране не тот текст, что в каталоге").toContain(ожидаемо);
  });

  test("ключевые слова оговорки доходят до человека", () => {
    // Не «есть какой-то текст», а именно то, ради чего оговорка написана.
    const { container } = render(<ProductNotice productId="qpaynet" />);
    const t = (container.textContent || "").toLowerCase();
    expect(t, "не сказано, что режим демонстрационный").toContain("демонстрационн");
    expect(t, "не сказано, что мы не банк").toContain("не является лицензированным банком");
    expect(t, "не сказано, что реальные средства не обрабатываются").toContain("реальные средства");
  });

  test("у продукта без оговорки не рисуется ничего", () => {
    const { container } = render(<ProductNotice productId="cyberchess" />);
    expect(container.textContent, "нарисована оговорка, которой в каталоге нет").toBe("");
  });

  test("неизвестный продукт и ключ прототипа не роняют страницу", () => {
    expect(render(<ProductNotice productId="net-takogo-produkta" />).container.textContent).toBe("");
    expect(render(<ProductNotice productId="constructor" />).container.textContent).toBe("");
  });
});
