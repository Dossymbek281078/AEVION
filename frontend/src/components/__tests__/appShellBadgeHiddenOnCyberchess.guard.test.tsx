import { describe, test, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * Сторож: в оболочке приложений значок цели тоже скрыт на денежных входах.
 *
 * 🔴 Почему отдельный файл. /cyberchess — app-оболочка, и значок там рисует НЕ
 * RevenueGoalBadge, а AppShellRevenueBadge. Проверив только общую шапку, я объявил бы
 * «значок убран с /cyberchess», а он остался бы — это ровно класс «починил аналог, а
 * не замеренный путь». Правило у обоих компонентов одно (lib/revenueBadgeHidden),
 * но вызывают они его сами, поэтому охраняем оба.
 */

const { путь, ширина } = vi.hoisted(() => ({
  путь: { значение: "/cyberchess" },
  ширина: { значение: 1200 },
}));

vi.mock("next/navigation", () => ({ usePathname: () => путь.значение }));
vi.mock("@/lib/useRevenueGoal", () => ({
  useRevenueGoal: () => ({
    goals: { millionUsd: 1_000_000 },
    summary: { grossUsd: 19.98 },
    pct: 0.002,
    days: 88,
  }),
}));
vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => ({ lang: "ru" }) }));
vi.mock("@/lib/revenueTip", () => ({ revenueTip: () => "подсказка" }));

const { AppShellRevenueBadge } = await import("../AppShellRevenueBadge");

beforeAll(() => {
  // Компонент показывает значок только на широком экране: без matchMedia он
  // честно молчит, и тогда тест зеленел бы на пустоте.
  window.matchMedia = ((q: string) => ({
    matches: ширина.значение >= 420,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => cleanup());

describe("значок цели в оболочке приложений", () => {
  test("на /cyberchess значка нет", () => {
    путь.значение = "/cyberchess";
    const { container } = render(<AppShellRevenueBadge />);
    expect(container.textContent ?? "", "значок остался на бесплатном магните").not.toContain(
      "$1M",
    );
  });

  test("на партии внутри шахмат тоже нет", () => {
    путь.значение = "/cyberchess/game/abc";
    const { container } = render(<AppShellRevenueBadge />);
    expect(container.textContent ?? "").not.toContain("$1M");
  });

  test("КОНТРОЛЬ: в чужой оболочке (/build) значок остался", () => {
    // Без контроля правка «скрыть» легко превращается в «убрать во всей оболочке».
    путь.значение = "/build";
    const { container } = render(<AppShellRevenueBadge />);
    expect(container.textContent ?? "", "значок пропал там, где он нужен").toContain("$1M");
  });
});
