import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Книга «Gratitude ∞ Forever Young» и страница долголетия — одно направление
 * (бренд ForeverYoung, тема антиэйджа). Замер 29.08.2026: книга продавалась,
 * а страница не упоминала её ни разу, и своей страницы у книги нет вовсе.
 *
 * Сторож охраняет ровно два свойства, а не вёрстку:
 *  1) страница ведёт в кассу книги через позицию каталога;
 *  2) цена книги не написана прозой (её называет чекаут).
 *
 * Проверено мутацией: убрать блок BOOK — краснеет; вписать «$29.99» в
 * текст — краснеет. Границу знать полезно: сторож не проверяет, что
 * карточка ВИДНА человеку, это свойство отрисовки, а не исходника.
 */
const SRC = readFileSync(
  join(process.cwd(), "src/app/longevity/_client.tsx"),
  "utf8",
);

describe("страница долголетия предлагает книгу того же направления", () => {
  it("книга берётся из каталога, а не зашита ссылкой", () => {
    expect(SRC).toContain('productById("ghvzq")');
    // ссылка строится из позиции каталога, а не из литерала gumroad
    expect(SRC).toMatch(/withChannel\(\s*BOOK\.href/);
  });

  it("в кассу ведёт настоящая кнопка покупки с меткой канала", () => {
    const card = SRC.slice(SRC.indexOf("{BOOK && ("));
    expect(card.length).toBeGreaterThan(0);
    expect(card).toContain("<BuyLink");
    expect(card).toContain('source="longevity-book"');
    expect(card).toContain("productId={BOOK.id}");
  });

  it("цена книги не названа числом в прозе", () => {
    // 29.99 / 14.99 / 9.99 — отставные и живые цены книги: в тексте страницы
    // их быть не должно ни в каком виде, только через BOOK.priceUsd
    const prose = SRC.replace(/\{BOOK\.priceUsd\}/g, "");
    for (const n of ["29.99", "14.99", "9.99"]) {
      expect(prose).not.toContain(n);
    }
  });
});
