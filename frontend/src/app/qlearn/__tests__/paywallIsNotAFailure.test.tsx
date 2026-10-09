import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/*
 * 🔴 ПЛАТНАЯ СТЕНА — НЕ ПОЛОМКА КАТАЛОГА.
 *
 * Замер 08.10.2026: /api/qlearn/courses у гостя отвечает 402 upgrade_required
 * (модуль закрыт ПО ЗАМЫСЛУ — moduleAccess: продаётся false, стена true,
 * «открывается только планетой»). Страница читала поле `warning`, которого в
 * теле стены нет (там `message`), и показывала «Каталог не загрузился. Это не
 * значит, что курсов нет…». Человеку, готовому заплатить, сообщали о СБОЕ
 * вместо предложения купить — это хуже пустоты: пустота не врёт о причине.
 *
 * ⚠️ Контроль обратной стороны обязателен и стоит ниже отдельным тестом:
 * различение «отказ хранилища (503)» и «пустой каталог» — чужая починка от
 * 21.08.2026 (её сторож — app/__tests__/failedLoadIsNotAnEmptyCatalog).
 * Общий помощник `fetchOrPaywall` здесь НЕ использован именно поэтому: он всё,
 * кроме 402, превращает в «страница без данных» и откатил бы её.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/qlearn",
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "ru" }),
  useI18nOptional: () => null,
}));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const ТЕЛО_СТЕНЫ = {
  error: "upgrade_required",
  module: "qlearn",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  authState: "anonymous",
  loginUrl: "https://aevion.app/auth?next=%2Fqlearn",
  message: "Если вы уже оплатили — войдите…",
};

function ответ(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("qlearn: стена и сбой — разные новости", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("402 -> экран стены, и НЕ «каталог не загрузился»", async () => {
    ответ(402, ТЕЛО_СТЕНЫ);
    const { default: QLearn } = await import("../page");
    render(<QLearn />);

    await waitFor(() => {
      expect(
        screen.queryByText(/входит в любую платную подписку|доступен на старших тарифах/i),
        "экран стены не показан — гость не узнает, что модуль покупается",
      ).not.toBeNull();
    });

    const текст = document.body.textContent || "";
    process.stderr.write(`[сторож] на 402 страница говорит: ${текст.slice(0, 160)}${String.fromCharCode(10)}`);
    expect(
      /не загрузился/i.test(текст),
      "стена по-прежнему названа поломкой каталога",
    ).toBe(false);
  });

  test("КОНТРОЛЬ: 503 -> по-прежнему сообщение об отказе, а не стена", async () => {
    ответ(503, { warning: "Хранилище недоступно, курсы есть" });
    const { default: QLearn } = await import("../page");
    render(<QLearn />);

    await waitFor(() => {
      const t = document.body.textContent || "";
      expect(
        /Хранилище недоступно|не загрузился/i.test(t),
        "отказ хранилища перестал быть виден — откачена починка от 21.08.2026",
      ).toBe(true);
    });
    expect(
      /входит в любую платную подписку/i.test(document.body.textContent || ""),
      "сбой показан как платная стена — это обман в другую сторону",
    ).toBe(false);
  });
});
