import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * СТАДИЯ: человек читает подпись, сервер получает ключ.
 *
 * До 01.09.2026 список выводил само значение — покупатель видел «pre-seed»
 * и «series-a». Это внутренние ключи, попавшие на экран.
 *
 * Проверяются ОБЕ половины сразу, и вторая важнее первой: перевести подпись
 * легко, а вместе с ней случайно перевести и value — тогда на сервер уедет
 * «Раунд A», и разбор молча перестанет работать. Такая поломка не падает:
 * форма отправится, ответ придёт, стадия будет неизвестной.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/qventure",
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));

import QVenturePage from "../page";
import { STAGES, STAGE_LABEL } from "../_result";

describe("список стадий", () => {
  test("значение машинное, подпись человеческая", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    render(<QVenturePage />);

    const selects = screen.getAllByRole("combobox");
    const stage = selects
      .map((s) => Array.from(s.querySelectorAll("option")))
      .find((opts) => opts.some((o) => o.getAttribute("value") === "series-a"));

    expect(stage, "список стадий не найден на странице").toBeTruthy();
    const opts = stage as HTMLOptionElement[];

    // Значения — ровно ключи, в том же составе. Перевели value — тест краснеет.
    expect(opts.map((o) => o.getAttribute("value"))).toEqual([...STAGES]);

    // Подписи — из карты, и они ОТЛИЧАЮТСЯ от ключей. Второе утверждение
    // отдельно: без него тест прошёл бы и на карте, где подпись равна ключу,
    // то есть на невыполненной работе.
    expect(opts.map((o) => o.textContent)).toEqual(STAGES.map((s) => STAGE_LABEL[s]));
    expect(opts.every((o) => o.textContent !== o.getAttribute("value")), "подпись совпала с ключом").toBe(true);
  });
});
