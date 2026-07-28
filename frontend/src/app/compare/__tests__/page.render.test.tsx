import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ComparePage, { buildRivalIndex } from "../page";
import { COMPARISONS, NON_PRODUCT_RIVALS } from "@/data/competitors";

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

  it("указатель «чем заменить X» ведёт на существующие карточки, а не в никуда", () => {
    // Якоря собираются из id модулей, а карточки — из тех же id, поэтому
    // разъехаться они могут только при правке одной стороны. Проверка стоит
    // одной строки, а битая ссылка в указателе выглядит как сломанная страница.
    const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const cardIds = new Set([...html.matchAll(/<article id="([^"]+)"/g)].map((m) => m[1]));
    expect(anchors.length, "Указатель аналогов пуст").toBeGreaterThan(10);

    const broken = [...new Set(anchors)].filter((a) => !cardIds.has(a));
    expect(broken, "Ссылка ведёт на несуществующий якорь: " + broken.join(", ")).toEqual([]);
  });

  it("указатель не предлагает заменить живого специалиста приложением", () => {
    // «нарколог → PsyApp» и «живой психотерапевт → QGood» — строки, которые
    // читаются как обещание, которого мы не даём. В самом сравнении такие
    // аналоги остаются (с ними нас и правда сравнивают), в указателе замены —
    // нет. Дефект нашёлся глазами на превью, ни один тест его не видел.
    const listed = buildRivalIndex().map((r) => r.rival);
    const wrong = listed.filter((r) => NON_PRODUCT_RIVALS.has(r));
    expect(wrong, "В указателе замены оказался не продукт: " + wrong.join(", ")).toEqual([]);
    expect(listed.length, "Указатель опустел целиком").toBeGreaterThan(10);
  });

  it("каждый названный аналог попал в указатель", () => {
    const rivals = new Set(COMPARISONS.flatMap((c) => c.rivals));
    const missing = [...rivals].filter((r) => !html.includes(escapeForHtml(r)));
    expect(missing, "Аналог назван в данных, но не выведен: " + missing.join(", ")).toEqual([]);
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
