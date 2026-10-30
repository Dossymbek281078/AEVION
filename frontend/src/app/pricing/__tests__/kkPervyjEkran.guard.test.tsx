import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { PRICING_DICT, kkDict } from "@/lib/pricingI18n";
import pricing from "./__fixtures__/pricing.json";
import checkoutHealthz from "./__fixtures__/checkoutHealthz.json";
import promo from "./__fixtures__/promo.json";
import testimonials from "./__fixtures__/testimonials.json";
import trust from "./__fixtures__/trust.json";

/**
 * /pricing НА KK — ПЕРВЫЙ ЭКРАН ПО-КАЗАХСКИ, ПЕРЕД ОТЗЫВАМИ НИ РУССКОГО, НИ АНГЛИЙСКОГО.
 *
 * Повод: проход Бюро на проде 30.10.2026 (390 px, kk): h1 «Цены AEVION», кнопка «Выбрать Max»,
 * «Crypto-grade signatures», «Ask about plans»; на en «12-months commitment».
 * Казахский — тоже кириллица, поэтому «кириллицы 0» проверяем как «нет русских слов и русских
 * букв э/щ/ё/ъ». Отзывы клиентов и описания модулей приходят с бэкенда по-русски — они ниже
 * первого экрана и проверкой не охвачены (граница честно названа).
 */
const ОТВЕТЫ: Array<[string, unknown]> = [
  ["/api/pricing/checkout/healthz", checkoutHealthz],
  ["/api/pricing/testimonials", testimonials],
  ["/api/pricing/promo", promo],
  ["/api/pricing/trust", trust],
  ["/api/pricing", pricing],
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/pricing",
}));

async function текстСтраницы(lang: "kk" | "en") {
  localStorage.setItem("aevion_lang_v1", lang);
  vi.stubGlobal("fetch", async (u: string) => {
    const f = ОТВЕТЫ.find(([p]) => String(u).includes(p));
    return { ok: !!f, status: f ? 200 : 404, json: async () => (f ? f[1] : {}) } as unknown as Response;
  });
  const m = await import("@/app/pricing/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  return document.body.textContent ?? "";
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); try { localStorage.clear(); } catch { /* пусто */ } });

describe("/pricing на kk", () => {
  it("первый экран (до отзывов) — без русского и английского", async () => {
    const весь = await текстСтраницы("kk");
    const граница = весь.indexOf(kkDict["testimonials.title"]);
    // Контроль прибора: граница найдена и до неё есть тарифы и кнопка.
    expect(граница, "заголовок отзывов не найден — прибор слеп").toBeGreaterThan(1000);
    const экран = весь.slice(0, граница);
    expect(экран).toContain("Max таңдау");
    for (const чужое of [
      "Выбрать", "Цены AEVION", "Замените", "Подробнее", "Экономия", "списание", "Без обязательств",
      "Crypto-grade signatures", "Ask about plans", "Choose ", "More about", "Billed monthly", "in progress",
    ]) {
      expect(экран, `на kk первый экран содержит «${чужое}»`).not.toContain(чужое);
    }
    expect(экран.match(/[эщёъЭЩЁЪ]/g) ?? [], "русские буквы э/щ/ё/ъ на kk").toEqual([]);
    expect(весь).toContain("Криптографиялық берік қолтаңбалар");
    expect(весь).toContain(kkDict["ask.title"]);
  });

  it("словарь kk: каждый ключ есть в en, значения не равны русским", () => {
    // Слова, одинаковые в русском и казахском (или не переводимые): не ошибка.
    const ТЕ_ЖЕ = new Set(["modules.colModule", "calc.title", "calc.tier", "newsletter.placeholder"]);
    for (const [k, v] of Object.entries(kkDict)) {
      expect(PRICING_DICT.en[k], `ключ ${k} есть в kk, но нет в en`).toBeTruthy();
      if (!ТЕ_ЖЕ.has(k)) expect(v, `ключ ${k} в kk совпал с русским`).not.toBe(PRICING_DICT.ru[k]);
    }
    expect(PRICING_DICT.kk["promo.capNote"]).toBe(kkDict["promo.capNote"]);
  });
});

describe("/pricing на en", () => {
  it("срок — «12-month commitment», а не «12-months»", async () => {
    const текст = await текстСтраницы("en");
    expect(текст).toContain("12-month commitment");
    expect(текст).not.toMatch(/\d-months commitment/);
  });
});
