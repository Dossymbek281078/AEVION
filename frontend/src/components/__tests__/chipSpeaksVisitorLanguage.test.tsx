/**
 * Кнопка покупки говорит на языке посетителя.
 *
 * До 14.09.2026 все надписи чипа были зашиты по-русски: на 38 страницах
 * модулей посетитель, выбравший English, видел английскую страницу и
 * «Купить», «/мес», русские подсказки — ровно там, где решается покупка.
 *
 * 15.09.2026 чип переведён на лестницу сроков; словарные ключи поменялись
 * (from, appAlone, planetFrom, includedInPlanet), и все они обязаны быть
 * переведены. Проверяем обе ветки чипа — приложение и модуль в подписке.
 *
 *   en  — в тексте и подсказках чипа нет кириллицы (сама находка);
 *   ru  — «Купить» на месте (иначе «нет кириллицы» прошло бы и у пустого чипа);
 *   без провайдера — прежний русский текст (страницы и тесты вне I18nProvider
 *   не должны ни падать, ни менять язык).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import ModulePricingChip from "../ModulePricingChip";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

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

function guest() {
  globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
}

describe("ModulePricingChip говорит на языке посетителя", () => {
  it.each(["qskyway", "cyberchess"])("en (%s): ни в тексте, ни в подсказках нет кириллицы", async (moduleId) => {
    guest();
    setLangCookie("en");
    const { container } = render(
      <I18nProvider>
        <ModulePricingChip moduleId={moduleId} />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("Buy")).toBeTruthy());
    const text = visibleText(container);
    expect(text).toContain("/mo");
    expect(hasCyrillic(text), `русское в английском чипе: ${text}`).toBe(false);
  });

  it("контроль ru: кнопка «Купить» и «/мес» на месте", async () => {
    guest();
    setLangCookie("ru");
    const { container } = render(
      <I18nProvider>
        <ModulePricingChip moduleId="qskyway" />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
    expect(visibleText(container)).toContain("/мес");
  });

  it("контроль без провайдера: русский текст, подсказка называет цену лестницы", async () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="cyberchess" />);
    await waitFor(() => expect(screen.getByText("Купить")).toBeTruthy());
    expect(visibleText(container)).toContain("от $12/мес при оплате за 12 месяцев");
  });
});
