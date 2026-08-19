/**
 * Чип цен стоит на денежном пути: он же открывает кассу. Имена тарифов на нём
 * ДОЛЖНЫ совпадать с теми, что человек увидит на кассе и в письме, — до 19.08
 * третий тариф был подписан «Полный доступ», хотя в /api/pricing, на кассе и в
 * подсказке рядом он называется «Full». Четвёртое имя одной строки — это когда
 * человек ищет купленное и не находит.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";

const PRICING = {
  tiers: [
    { id: "lite", name: "Lite", priceMonthly: 19 },
    { id: "medium", name: "Medium", priceMonthly: 29 },
    { id: "full", name: "Full", priceMonthly: 49 },
  ],
  currencies: { USD: { rate: 1, symbol: "$", label: "USD" } },
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ModulePricingChip — имена тарифов", () => {
  it("показывает имена так же, как их называет источник цен", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => PRICING })) as unknown as typeof fetch;

    render(<ModulePricingChip moduleId="cyberchess" />);

    for (const name of ["Lite", "Medium", "Full"]) {
      const el = await waitFor(() => screen.getByText(name));
      expect(el.getAttribute("translate"), `${name}: имя тарифа уйдёт в перевод`).toBe("no");
    }
    expect(screen.queryByText(/Полный доступ/)).toBeNull();
  });
});
