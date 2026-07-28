import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ComparePage from "../page";
import { COMPARISONS } from "@/data/competitors";

/**
 * Данные могут быть честными, а страница — показывать половину.
 *
 * Отдельный класс дефекта: сравнение лежит в competitors.ts, страж его
 * проверяет, а в разметку попадает только колонка «в чём сильнее мы» — потому
 * что кто-то убрал второй блок ради компактности. Снаружи это выглядит ровно
 * как реклама, против которой и написан страж, и ни один тест данных этого не
 * увидит.
 *
 * Поэтому проверяем итоговый HTML, а не массив.
 */

describe("страница сравнения показывает обе стороны", () => {
  const html = renderToStaticMarkup(<ComparePage />);

  it("рендерится без падения и не пустая", () => {
    expect(html.length).toBeGreaterThan(2000);
  });

  it("каждый модуль виден на странице", () => {
    const missing = COMPARISONS.filter((c) => !html.includes(c.name)).map((c) => c.id);
    expect(missing, "Модуль есть в данных, но не в разметке: " + missing.join(", ")).toEqual([]);
  });

  it("сильные стороны аналогов доходят до разметки, а не только до данных", () => {
    // Берём первую слабую строку каждого модуля: если колонка «в чём сильнее
    // они» исчезнет из вёрстки, здесь станет красно сразу по всем модулям.
    const lost: string[] = [];
    for (const c of COMPARISONS) {
      const line = c.weaker[0];
      if (!html.includes(escapeForHtml(line))) lost.push(c.id);
    }
    expect(lost, "Слабые стороны не попали в HTML: " + lost.join(", ")).toEqual([]);
  });

  it("названы конкуренты, а не безличные «аналоги»", () => {
    const lost = COMPARISONS.filter((c) => !html.includes(escapeForHtml(c.rivals[0]))).map((c) => c.id);
    expect(lost, "Аналог не назван по имени: " + lost.join(", ")).toEqual([]);
  });

  it("на странице есть оговорка о том, чего в сравнении нет", () => {
    expect(html).toContain("Чего здесь нет");
  });
});

/** React экранирует кавычки и амперсанды — сравниваем в том же виде. */
function escapeForHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
