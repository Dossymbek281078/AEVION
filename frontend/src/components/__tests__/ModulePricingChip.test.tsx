/**
 * Плашка цены на странице модуля называет цены ЛЕСТНИЦЫ СРОКОВ (политика
 * 15.09.2026) и ведёт туда, где их можно оплатить.
 *
 * До 15.09 плашка читала /api/pricing и показывала помесячные тарифы
 * Lite/Medium/Full — этих тарифов больше нет. Теперь:
 *   · одно из пяти приложений → «от $X/мес», «<имя> отдельно», «вся планета от $200/мес»;
 *   · любой другой модуль     → «Входит в подписку AEVION · от $200/мес».
 * Числа — из @/lib/termPricing; снятые цены на плашке появиться не должны.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";
import { PLANET_BASE_MONTHLY, STANDALONE_APPS, fromPricePerMonth } from "@/lib/termPricing";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function guest() {
  globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
}

describe("ModulePricingChip — цены лестницы сроков", () => {
  it.each(STANDALONE_APPS.map((a) => [a.moduleId, a] as const))(
    "приложение %s: своя цена «от», имя и цена всей планеты",
    (moduleId, app) => {
      guest();
      const { container } = render(<ModulePricingChip moduleId={moduleId} />);
      const text = container.textContent ?? "";
      expect(text).toContain(`$${fromPricePerMonth(app.baseMonthly)}`);
      expect(text).toContain(app.name);
      expect(text).toContain(`от $${fromPricePerMonth(PLANET_BASE_MONTHLY)}/мес`);
      const buy = screen.getByText("Купить").closest("a")!;
      expect(buy.getAttribute("href")).toBe(`/pricing?app=${app.slug}#apps`);
    },
  );

  it("модуль вне пяти: входит в подписку, отдельной цены нет", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="qlearn" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Входит в подписку AEVION");
    expect(text).toContain(`$${fromPricePerMonth(PLANET_BASE_MONTHLY)}`);
    expect(text).not.toContain("отдельно");
    expect(screen.getByText("Купить").closest("a")!.getAttribute("href")).toBe("/pricing#tiers");
  });

  it("короткий id витрины тоже узнаётся: bureau — это IP Bureau", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="bureau" />);
    expect(container.textContent).toContain("IP Bureau");
  });

  it("снятые цены и имена тарифов на плашке не появляются", () => {
    guest();
    for (const id of ["cyberchess", "qlearn", "devhub"]) {
      const { container } = render(<ModulePricingChip moduleId={id} />);
      const text = container.textContent ?? "";
      expect(text, id).not.toMatch(/\$(19|29|39|49|59|149)(?!\d)|Universe|All-Access/);
      cleanup();
    }
  });

  it("имя приложения не уходит в машинный перевод", () => {
    guest();
    render(<ModulePricingChip moduleId="cyberchess" />);
    const el = screen.getByText(/CyberChess/);
    expect(el.getAttribute("translate")).toBe("no");
  });
});
