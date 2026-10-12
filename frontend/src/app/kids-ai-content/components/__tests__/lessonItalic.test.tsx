/*
 * Урок для ребёнка не показывает звёздочки разметки. Замер прода 12.10.2026
 * (окно Приложения-31.12): «Один — это когда вещь *одна*» печаталось со
 * звёздочками. Контроли: пункт списка «* …» и умножение «2 * 3» не ломаются.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMarkdown } from "../LessonDetail";

const html = (md: string) => renderToStaticMarkup(<div>{renderMarkdown(md)}</div>);

describe("уроки Kids: курсив без звёздочек", () => {
  it("*одна* → <em>, звёздочек нет", () => {
    const h = html("Один — это когда вещь *одна*. Покажи один палец.");
    expect(h).toContain("<em>одна</em>");
    expect(h).not.toContain("*");
  });

  it("жирный по-прежнему жирный", () => {
    expect(html("**Шаг 1.** Считаем")).toContain("<strong>Шаг 1.</strong>");
  });

  it("КОНТРОЛЬ: умножение с пробелами не превращается в курсив", () => {
    const h = html("Посчитай: 2 * 3 * 4");
    expect(h).not.toContain("<em>");
    expect(h).toContain("2 * 3 * 4");
  });
});
