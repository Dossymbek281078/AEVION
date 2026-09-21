import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Тексты «На чьих плечах» — сжатый пересказ идей (North, Acemoglu, Ostrom и др.),
 * а не выписки из книг. В кавычках рядом с фамилией это читается как прямая
 * цитата, то есть как ложное свидетельство — на странице продукта, который
 * продаёт доказуемость. Проверять дословность нам нечем, выдумывать точные
 * формулировки нельзя; значит пересказ обязан называться пересказом.
 */
const СТРАНИЦА = join(__dirname, "..", "showcase", "page.tsx");
const СЛОВАРИ = join(__dirname, "..", "..", "..", "lib", "i18n-lang");

describe("идеи авторов не выдаются за прямые цитаты", () => {
  it("КОНТРОЛЬ прибора: страница читается и блок цитат в ней есть", () => {
    const s = readFileSync(СТРАНИЦА, "utf8");
    expect(s.includes("ACADEMIC_QUOTES"), "блок исчез — сторож смотрит не туда").toBe(true);
    expect(s.includes("q.text"), "текста идей нет — сторож смотрит не туда").toBe(true);
  });

  it("текст идеи не обёрнут в кавычки", () => {
    const s = readFileSync(СТРАНИЦА, "utf8");
    expect(s.includes('"{q.text}"'), "текст снова подан как прямая цитата").toBe(false);
  });

  it("рядом стоит пометка «пересказ» — во всех трёх языках страницы", () => {
    for (const l of ["ru", "en", "kk"]) {
      const d = readFileSync(join(СЛОВАРИ, `${l}.ts`), "utf8");
      expect(d.includes("constitution.showcase.paraphrase"), `${l}: пометки нет`).toBe(true);
    }
    expect(readFileSync(СТРАНИЦА, "utf8").includes("constitution.showcase.paraphrase")).toBe(true);
  });
});
