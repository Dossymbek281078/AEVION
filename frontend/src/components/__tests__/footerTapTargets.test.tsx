import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { SiteFooter } from "../SiteFooter";

/**
 * Ссылки подвала пригодны для пальца.
 *
 * Замер 31.08.2026 в настоящем браузере на экране 390px: ссылки подвала имели
 * высоту 20px при нижней границе 24px (WCAG 2.5.8). Трафик воронки идёт с
 * роликов, то есть почти весь с телефонов, и подвал — единственное место, где
 * лежат «Помощь», «Условия» и переход к новостям.
 *
 * Проверка смотрит на объявленный минимум, а не на отрисованную высоту: jsdom
 * вёрстку не считает. Это ловит реальную регрессию — новую ссылку, добавленную
 * мимо общего стиля.
 */

describe("подвал: площадь касания", () => {
  test("у каждой ссылки задан минимум 24px", () => {
    const { container } = render(<SiteFooter />);
    const links = [...container.querySelectorAll("a")];

    // Контроль охвата: пустой подвал прошёл бы проверку молча.
    expect(links.length).toBeGreaterThanOrEqual(10);

    const мелкие = links
      .filter((a) => {
        const h = parseInt((a as HTMLAnchorElement).style.minHeight || "0", 10);
        return !h || h < 24;
      })
      .map((a) => (a.textContent || "").trim().slice(0, 24));

    expect(мелкие, "ссылка подвала без площади касания: используйте footerLink").toEqual([]);
  });
});
