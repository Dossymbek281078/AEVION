import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";

/**
 * Кнопка «Купить» на странице модуля не продаёт то, что у человека уже есть.
 *
 * История: 01.09.2026 соседнее окно измерило на сквозном стенде — купил medium,
 * затем «докупил модуль» и получил LITE: кнопка жёстко оформляла Lite и не
 * спрашивала тариф. Правка убрала вред: платящему больше Lite кнопку не показывать.
 *
 * 15.09.2026 — новая ценовая политика: ЛЮБОЙ платный тариф (срок 1–12 месяцев)
 * открывает все модули. Значит, подписчику любой ступени кнопка «Купить» не
 * нужна вовсе — вместо неё «Уже включено». Незнание по-прежнему трактуется в
 * пользу покупки: гость, человек без входа и незнакомый тариф кнопку видят.
 */

vi.mock("@/lib/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

/**
 * Фикстура повторяет ЖИВОЙ ответ /api/me/entitlements, а не удобную выдумку:
 * { plan, email, reason, modules: [{ module, requiredTiers, entitled }] }.
 */
function mockPlan(plan: string | null, entitled = false) {
  globalThis.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes("entitlements")) {
      return plan === null
        ? ({ ok: false, json: async () => ({}) } as Response)
        : ({
            ok: true,
            json: async () => ({
              plan,
              email: null,
              reason: "test",
              modules: [{ module: "qlearn", requiredTiers: ["lite"], entitled }],
            }),
          } as Response);
    }
    return { ok: false, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

describe("кнопка модуля не продаёт то, что уже есть", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("контроль: гостю кнопка «Купить» ПОКАЗЫВАЕТСЯ", async () => {
    // Без этой стороны правка выродилась бы в «спрятали кассу».
    mockPlan("free");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });

  it("человеку без входа — тоже: незнание не закрывает кассу", async () => {
    mockPlan(null);
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });

  it.each(["lite", "medium", "pro", "full", "max", "enterprise"])(
    "подписчику ступени %s кнопки «Купить» нет — все модули уже открыты",
    async (plan) => {
      mockPlan(plan);
      render(<ModulePricingChip moduleId="qlearn" />);
      // Ждём ПОЛОЖИТЕЛЬНОГО признака: отсутствие кнопки выполняется и само собой,
      // пока права ещё грузятся, — мутация «снять проверку» такой тест не роняла.
      await waitFor(() => expect(screen.getByText("Уже включено")).toBeTruthy());
      expect(screen.queryByText("Купить"), `${plan} уже открывает все модули`).toBeNull();
    },
  );

  it("незнакомое значение тарифа не прячет кассу", async () => {
    mockPlan("some-new-tier");
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });

  it("бесплатный тариф с entitled=true кнопку НЕ прячет: стена может быть выключена", async () => {
    mockPlan("free", true);
    render(<ModulePricingChip moduleId="qlearn" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
  });
});
