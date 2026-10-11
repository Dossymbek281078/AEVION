import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/*
 * 🔴 ОТКАЗ СТЕНЫ НЕ ИМЕЕТ ПРАВА БЫТЬ МОЛЧАЛИВЫМ.
 *
 * Замер 08.10.2026: /api/qai/personas у гостя -> 402 upgrade_required (модуль
 * закрыт ПО ЗАМЫСЛУ). Страница делала `r.ok ? r.json() : null` и пустой
 * `.catch(() => {})` — тело 402 терялось, оставалась заглушка, и человек
 * видел шапку и пустоту, не узнав ни причины, ни того, что модуль покупается.
 *
 * Контроль обратной стороны ниже: СЕТЕВОЙ сбой стеной называть нельзя —
 * это обман в другую сторону, и заглушка в этом случае остаётся как была.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/qai",
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "ru" }),
  useI18nOptional: () => null,
}));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const ТЕЛО_СТЕНЫ = {
  error: "upgrade_required",
  module: "qai",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  authState: "anonymous",
  loginUrl: "https://aevion.app/auth?next=%2Fqai",
  message: "Если вы уже оплатили — войдите…",
};

// В jsdom нет scrollIntoView, а страница прокручивает ленту к низу.
// Заглушка стенда, не предмета проверки: без неё падает рендер, и сторож
// краснел бы на исправном коде.
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("qai: стена говорит, а не молчит", () => {
  test("402 -> экран стены вместо пустоты", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 402, json: async () => ТЕЛО_СТЕНЫ,
    }) as unknown as typeof fetch;

    const { default: QAi } = await import("../page");
    render(<QAi />);

    await waitFor(() => {
      expect(
        screen.queryByText(/входит в любую платную подписку|доступен на старших тарифах/i),
        "на 402 по-прежнему пустота: человек не узнаёт ни причины, ни того, что модуль покупается",
      ).not.toBeNull();
    });
    process.stderr.write(
      `[сторож] на 402 страница говорит: ${(document.body.textContent || "").slice(0, 150)}${String.fromCharCode(10)}`,
    );
  });

  test("КОНТРОЛЬ: сетевой сбой — НЕ стена", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { default: QAi } = await import("../page");
    render(<QAi />);

    await new Promise((r) => setTimeout(r, 50));
    expect(
      /входит в любую платную подписку|доступен на старших тарифах/i.test(document.body.textContent || ""),
      "сетевой сбой показан как платная стена — обман в другую сторону",
    ).toBe(false);
  });
});
