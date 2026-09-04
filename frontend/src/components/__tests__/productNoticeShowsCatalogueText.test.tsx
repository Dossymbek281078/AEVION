import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProductNotice } from "../ProductNotice";
import { productById } from "@/lib/products";

describe("оговорка продукта берётся из каталога", () => {
  test("контроль: у qpaynet оговорка в каталоге есть", () => {
    // Иначе «компонент её показывает» могло бы означать «показывать нечего».
    expect(productById("qpaynet")?.notice, "оговорка исчезла из каталога").toBeTruthy();
  });

  test("текст на экране совпадает с каталогом дословно", () => {
    const ожидаемо = productById("qpaynet")!.notice!;
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

  test("неизвестный продукт не роняет страницу", () => {
    const { container } = render(<ProductNotice productId="net-takogo-produkta" />);
    expect(container.textContent).toBe("");
  });
});
