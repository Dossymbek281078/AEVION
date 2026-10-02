import { describe, test, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * Сторож: на /bureau нет значка «🎯 $1M: 0.00%».
 *
 * 🔴 Замер окна 2b 02.10.2026: письма лабораториям ИИ ведут на /bureau, и получатель
 * первым видит прогресс к нашей цели — ноль процентов. Для покупателя данных это
 * читается однозначно: «у них ничего не продаётся». Значок честен и полезен нам
 * внутри, но страница, куда приходит покупатель по личному письму, не место для
 * нашей внутренней отчётности.
 *
 * Контроль обязателен в обратную сторону: на других страницах значок должен
 * остаться. Без него правка «спрятать» легко превращается в «убрать везде».
 */

const { путь } = vi.hoisted(() => ({ путь: { значение: "/" } }));

vi.mock("next/navigation", () => ({ usePathname: () => путь.значение }));
vi.mock("@/lib/useRevenueGoal", () => ({
  useRevenueGoal: () => ({
    goals: { millionUsd: 1_000_000 },
    summary: { grossUsd: 19.98 },
    pct: 0.002,
    days: 91,
  }),
}));
vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => ({ lang: "ru" }) }));
vi.mock("@/lib/revenueTip", () => ({ revenueTip: () => "подсказка" }));

const { default: RevenueGoalBadge } = await import("../RevenueGoalBadge");

afterEach(() => cleanup());

describe("значок прогресса и страница бюро", () => {
  test("на /bureau значка нет", () => {
    путь.значение = "/bureau";
    const { container } = render(<RevenueGoalBadge />);
    expect(container.textContent ?? "", "значок остался на странице для писем").not.toContain("$1M");
  });

  test("на подстранице бюро его тоже нет", () => {
    путь.значение = "/bureau/cert/abc";
    const { container } = render(<RevenueGoalBadge />);
    expect(container.textContent ?? "").not.toContain("$1M");
  });

  test("КОНТРОЛЬ: на главной значок остался", () => {
    путь.значение = "/";
    const { container } = render(<RevenueGoalBadge />);
    expect(container.textContent ?? "", "значок пропал там, где он нужен").toContain("$1M");
  });

  test("путь неизвестен (usePathname вернул null) — значок не падает", () => {
    // 🔴 Этот случай поймал мой же прогон, а не этот сторож: мок всегда отдавал
    // строку, а в настоящем дереве usePathname() бывает null, и значок РОНЯЛ ВСЮ
    // ШАПКУ («Cannot read properties of null» в чужом тесте keepChannelLink).
    // Проверка слабее того, кто примет значение, — наш записанный класс.
    путь.значение = null as unknown as string;
    const { container } = render(<RevenueGoalBadge />);
    expect(container.textContent ?? "", "при неизвестном пути ведём себя как раньше").toContain(
      "$1M",
    );
  });

  test("КОНТРОЛЬ: на /revenue значок остался", () => {
    путь.значение = "/revenue";
    const { container } = render(<RevenueGoalBadge />);
    expect(container.textContent ?? "").toContain("$1M");
  });
});
