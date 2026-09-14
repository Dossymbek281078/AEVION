/**
 * Кнопка покупки говорит на языке посетителя.
 *
 * До 14.09.2026 все надписи чипа были зашиты по-русски: на 38 страницах
 * модулей посетитель, выбравший English, видел английскую страницу и
 * «Купить», «/мес», русские подсказки — ровно там, где решается покупка.
 * Сторожа русского текста у модулей этого не видели: они читают только
 * папку своей страницы, а чип общий.
 *
 * Проверяем три случая, и два из них — контроли:
 *   en  — в тексте и подсказках чипа нет кириллицы (сама находка);
 *   ru  — «Купить» на месте (иначе «нет кириллицы» прошло бы и у пустого чипа);
 *   без провайдера — прежний русский текст (страницы и тесты вне I18nProvider
 *   не должны ни падать, ни менять язык).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import ModulePricingChip from "../ModulePricingChip";

const PRICING = {
  tiers: [
    { id: "lite", name: "Lite", priceMonthly: 19 },
    { id: "medium", name: "Medium", priceMonthly: 29 },
    { id: "full", name: "Full", priceMonthly: 49 },
  ],
  currencies: { USD: { rate: 1, symbol: "$", label: "USD" } },
};

const CYR_FROM = 0x400;
const CYR_TO = 0x4ff;
function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= CYR_FROM && c <= CYR_TO) return true;
  }
  return false;
}

/** Всё, что человек видит или получает подсказкой: текст и атрибуты title. */
function visibleText(root: HTMLElement): string {
  const titles = Array.from(root.querySelectorAll("[title]")).map((el) => el.getAttribute("title") ?? "");
  return [root.textContent ?? "", ...titles].join(" | ");
}

function setLangCookie(lang: string | null) {
  document.cookie = lang ? `aevion_lang_v1=${lang}; path=/` : "aevion_lang_v1=; path=/; max-age=0";
}

afterEach(() => {
  cleanup();
  setLangCookie(null);
  try { localStorage.clear(); } catch { /* окружение без хранилища */ }
  vi.restoreAllMocks();
});

function mockFetch() {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => PRICING })) as unknown as typeof fetch;
}

describe("ModulePricingChip говорит на языке посетителя", () => {
  it("en: ни в тексте, ни в подсказках чипа нет кириллицы", async () => {
    mockFetch();
    setLangCookie("en");
    const { container } = render(
      <I18nProvider>
        <ModulePricingChip moduleId="qskyway" />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("Buy")).toBeTruthy());
    const text = visibleText(container);
    expect(text).toContain("/mo");
    expect(hasCyrillic(text), `русское в английском чипе: ${text}`).toBe(false);
  });

  it("контроль ru: кнопка «Купить» и «/мес» на месте", async () => {
    mockFetch();
    setLangCookie("ru");
    const { container } = render(
      <I18nProvider>
        <ModulePricingChip moduleId="qskyway" />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
    expect(visibleText(container)).toContain("/мес");
  });

  it("контроль без провайдера: прежний русский текст, чип не падает", async () => {
    mockFetch();
    const { container } = render(<ModulePricingChip moduleId="qskyway" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
    expect(visibleText(container)).toContain("Купить Lite $19/мес");
  });
});
