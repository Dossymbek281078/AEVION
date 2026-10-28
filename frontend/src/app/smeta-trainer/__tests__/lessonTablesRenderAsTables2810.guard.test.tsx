import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../components/Markdown";
import { LESSONS } from "../lib/lessons";

/**
 * 28.10.2026, замер Продаж на 390×844: урок 1 тренажёра смет показывал таблицу
 * «Кто и когда её составляет» сырой разметкой «| Этап | Кто … |» и «|---|---|---|».
 * Причина — не ширина экрана, а рендер: components/Markdown.tsx не знал таблиц вовсе,
 * а в уроках их 57. Сторож рендерит КАЖДЫЙ урок с таблицей и требует <table> без
 * остатков разметки; плюс прямой случай и контроль, что строка с «|» без разделителя
 * остаётся текстом (ложная таблица хуже сырой).
 */
const РАЗДЕЛИТЕЛЬ = /^\s*\|?\s*:?-{3,}/m;

describe("таблицы уроков тренажёра смет рисуются таблицами", () => {
  const сТаблицей = LESSONS.filter((l) => /^\s*\|.*\|\s*$/m.test(l.content) && РАЗДЕЛИТЕЛЬ.test(l.content));

  it("контроль прибора: уроки с таблицами найдены", () => {
    expect(сТаблицей.length, "в уроках нет ни одной таблицы — поиск сломан или уроки переписаны").toBeGreaterThan(30);
  });

  it("каждый такой урок отдаёт <table> и не оставляет «|---|» на экране", () => {
    const сырые: string[] = [];
    for (const l of сТаблицей) {
      const html = renderToStaticMarkup(<Markdown text={l.content} />);
      if (!html.includes("<table") || /\|---|---\|/.test(html.replace(/<[^>]+>/g, ""))) сырые.push(l.id);
    }
    expect(сырые, "уроки, где таблица осталась сырой разметкой").toEqual([]);
  });

  it("прямой случай: заголовок, разделитель, две строки; жирный внутри ячейки", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"| Этап | Кто |\n|---|---|\n| Проектирование | **Сметчик** |\n| Приёмка | Заказчик |\n\nДалее текст."} />,
    );
    expect(html).toContain("<table");
    expect(html.match(/<th[ >]/g)?.length).toBe(2);
    expect(html.match(/<tr[ >]/g)?.length).toBe(3);
    expect(html).toContain("<strong");
    expect(html).toContain("Далее текст.");
    expect(html).not.toContain("|---|");
    // Прокрутка внутри блока, а не всей страницы: таблица на 390 px не растягивает документ.
    expect(html).toContain("overflow-x-auto");
  });

  it("строка с «|» без разделителя — обычный текст, не таблица", () => {
    const html = renderToStaticMarkup(<Markdown text={"Выбор: | да | нет |\nвторая строка"} />);
    expect(html).not.toContain("<table");
    expect(html).toContain("| да | нет |");
  });
});
