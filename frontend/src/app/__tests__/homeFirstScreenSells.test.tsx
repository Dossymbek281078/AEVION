// 30.10.2026 (разбор Науки): с «/» ушли 12 из 22 людей без клика. Первый экран должен вести в
// продаваемое: одна главная кнопка в DevHub с меткой канала и событием cta_click, ряд ссылок
// на цену/CyberChess/бюро/Мультичат, плашка «MVP» снята с первого экрана, карточки продаваемого
// идут сразу после него. Проверяется отрисовка, а не исходник.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const trackMock = vi.fn();
vi.mock("@/lib/track", () => ({ track: (p: unknown) => trackMock(p) }));
vi.mock("@/lib/channelNow", () => ({ channelNow: () => "youtube", сыраяМеткаКанала: () => "yt-devhub-2min" }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("../components/PlanetPulse", () => ({ PlanetPulse: () => null }));
vi.mock("@/components/ConstitutionEmbed", () => ({ ConstitutionEmbed: () => null }));
vi.mock("@/components/WaitlistCapture", () => ({ WaitlistCapture: () => null }));
vi.mock("@/components/PageTracking", () => ({ PageTracking: () => null }));
vi.mock("@/lib/planetData", () => ({ fetchPlanetStats: async () => null, fetchRecentArtifacts: async () => null }));

import HomePage from "../_home";
import { I18nProvider } from "@/lib/i18n";

const Page = () => (
  <I18nProvider>
    <HomePage />
  </I18nProvider>
);

beforeEach(() => {
  trackMock.mockClear();
  cleanup();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

const hrefs = (root: Element) => [...root.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");

/** Узлы первого экрана: всё, что идёт в DOM до секции «продаваемое» (она сразу за героем). */
function firstScreen(container: HTMLElement): { hero: Element; sellable: Element } {
  const sellable = container.querySelector('[data-testid="home-sellable"]')!;
  const hero = sellable.previousElementSibling!;
  return { hero, sellable };
}

describe("главная: первый экран ведёт в продаваемое", () => {
  test("главная кнопка в первом экране ведёт на /devhub с меткой канала", async () => {
    const { container } = render(<Page />);
    const btn = screen.getByTestId("home-primary-cta");
    const { hero } = firstScreen(container);
    expect(hero.contains(btn), "кнопка вне героя").toBe(true);
    expect(btn.getAttribute("href")).toMatch(/^\/devhub\?.*c=/);
  });

  test("клик по главной кнопке шлёт cta_click source=home target=devhub", () => {
    render(<Page />);
    fireEvent.click(screen.getByTestId("home-primary-cta"));
    expect(trackMock).toHaveBeenCalledWith({ type: "cta_click", source: "home", meta: { target: "devhub" } });
  });

  test("в первом экране нет «MVP», ни русского, ни английского", () => {
    const { container } = render(<Page />);
    const { hero } = firstScreen(container);
    expect(hero.textContent).not.toMatch(/Продуктовый MVP|Product MVP/i);
    expect((hero.textContent ?? "").length).toBeGreaterThan(100); // контроль: герой не пуст
  });

  test("в первом экране ссылки на цену, CyberChess, бюро, Мультичат", () => {
    const { container } = render(<Page />);
    const { hero } = firstScreen(container);
    const h = hrefs(hero).join(" ");
    for (const p of ["/pricing", "/cyberchess", "/bureau", "/multichat-engine"]) {
      expect(h, p).toContain(p);
    }
  });

  test("карточки продаваемого сразу после героя, у каждой метка канала", () => {
    const { container } = render(<Page />);
    const { sellable } = firstScreen(container);
    for (const k of ["bureau", "cyberchess", "devhub", "multichat"]) {
      const a = sellable.querySelector(`[data-testid="home-sellable-${k}"]`);
      expect(a, k).not.toBeNull();
      expect(a!.getAttribute("href"), k).toMatch(/c=/);
    }
    // сразу после героя, до блока покупок книг
    expect(sellable.nextElementSibling?.textContent).toMatch(/Buy now/);
  });
});
