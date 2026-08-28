import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShellRevenueBadge } from "../AppShellRevenueBadge";

/**
 * Плашка прогресса не должна перекрывать навигацию на телефоне.
 *
 * ЗАЧЕМ. Она прибита к левому верхнему углу (`fixed`, z-index 60), а в том же
 * углу у оболочек живут кнопки. Замер сторожа вёрстки 28.08.2026, экран 320:
 * на /qright плашка накрыла «← Глобус» и «Демо» — нажать их стало НЕЛЬЗЯ.
 *
 * Проверяем поведение, а не наличие строки в файле: тест на исходник остался
 * бы зелёным и при сломанном условии.
 */

vi.mock("@/lib/useRevenueGoal", () => ({
  useRevenueGoal: () => ({
    goals: { target: 1_000_000 },
    summary: { grossUsd: 20 },
    pct: 0.002,
    days: 126,
  }),
}));

/** Подменяет ширину экрана: jsdom своего matchMedia не имеет. */
function setWidth(px: number) {
  window.matchMedia = ((q: string) => {
    const m = /min-width:\s*(\d+)px/.exec(q);
    const min = m ? Number(m[1]) : 0;
    return {
      matches: px >= min,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

describe("плашка прогресса в оболочке", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("на узком экране не рисуется вовсе — навигация важнее подсказки", () => {
    setWidth(320);
    const { container } = render(<AppShellRevenueBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("на обычном телефоне (375) тоже не рисуется", () => {
    // 375 — ширина обычного iPhone. Порог выбран так, чтобы покрыть телефоны
    // целиком, а не только самые узкие.
    setWidth(375);
    const { container } = render(<AppShellRevenueBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("на широком экране рисуется — иначе цель просто исчезла бы", () => {
    // Обратный контроль: без него проверки выше проходили бы и в случае,
    // когда плашка сломана и не показывается нигде.
    setWidth(1280);
    render(<AppShellRevenueBadge />);
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.getByText(/126d/)).toBeInTheDocument();
  });

  it("остаётся ссылкой на /revenue", () => {
    setWidth(1280);
    render(<AppShellRevenueBadge />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/revenue");
  });
});
