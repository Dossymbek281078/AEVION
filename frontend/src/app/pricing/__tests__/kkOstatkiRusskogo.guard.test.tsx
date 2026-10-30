import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { PRICING_DICT } from "@/lib/pricingI18n";
import pricing from "./__fixtures__/pricing.json";
import checkoutHealthz from "./__fixtures__/checkoutHealthz.json";
import promo from "./__fixtures__/promo.json";
import testimonials from "./__fixtures__/testimonials.json";
import trust from "./__fixtures__/trust.json";
import ruDict from "@/lib/i18n-lang/ru";
import kkDictAll from "@/lib/i18n-lang/kk";

/**
 * /pricing на kk: остатки русского (31.10.2026, замер Мультичата и Продаж на проде 4cb36509f):
 * «Модуль», «Калькулятор», «ТАРИФ» на странице, «Глоссарий →» и «%/транз» — копии ru в kk.ts,
 * серверный блок для робота («Приложения и цены», «… в год») — русский на kk.
 */
const req = vi.hoisted(() => ({ search: "", al: "kk-KZ,kk;q=0.9", cookie: "kk" as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (req.cookie && n.includes("lang") ? { value: req.cookie } : undefined) }),
  headers: async () => ({
    get: (n: string) => (n === "x-aevion-search" ? req.search : n === "accept-language" ? req.al : null),
  }),
}));
vi.mock("@/lib/appsJsonLd", () => ({
  разметкаПриложений: async () => null,
  оплачиваемыеПриложения: async () => [
    { slug: "cyberchess", name: "CyberChess", yearOnlyUsd: 50, baseMonthly: 0 },
    { slug: "devhub", name: "DevHub", yearOnlyUsd: null, baseMonthly: 24 },
  ],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/pricing",
}));

// Русские слова целиком (казахские слова с тем же корнем — «ТАРИФТІК», «модульдер» — не ловим).
const Б = "А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі";
// «Модуль» не в списке: по-казахски это то же слово (колонка modules.colModule, «Барлық модульдер»).
const РУССКОЕ = new RegExp(
  `(?<![${Б}])(Калькулятор|ТАРИФ|Глоссарий|в год|в месяц|Приложения и цены|Цены приложений)(?![${Б}])`,
);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); try { localStorage.clear(); } catch { /* пусто */ } });

describe("/pricing на kk: остатки русского", () => {
  it("серверный блок цен — по-казахски", async () => {
    const { default: Layout } = await import("../layout");
    req.search = "?lang=kk";
    const html = renderToStaticMarkup(await Layout({ children: null }));
    expect(html, "прибор: блок вообще отрисован").toContain("CyberChess");
    expect(html).toContain("Қосымшалар және бағалар");
    expect(html).toContain("жылына $50.00");
    expect(html.match(РУССКОЕ), "русские слова в блоке").toBeNull();
    expect(html.match(/[эщёъЭЩЁЪ]/g) ?? [], "русские буквы в блоке").toEqual([]);
  });

  it("страница на kk: нет Модуль/Калькулятор/ТАРИФ/Глоссарий", async () => {
    localStorage.setItem("aevion_lang_v1", "kk");
    const ОТВЕТЫ: Array<[string, unknown]> = [
      ["/api/pricing/checkout/healthz", checkoutHealthz], ["/api/pricing/testimonials", testimonials],
      ["/api/pricing/promo", promo], ["/api/pricing/trust", trust], ["/api/pricing", pricing],
    ];
    vi.stubGlobal("fetch", async (u: string) => {
      const f = ОТВЕТЫ.find(([p]) => String(u).includes(p));
      return { ok: !!f, status: f ? 200 : 404, json: async () => (f ? f[1] : {}) } as unknown as Response;
    });
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => { render(<I18nProvider><Страница /></I18nProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const текст = document.body.textContent ?? "";
    expect(текст, "прибор: страница отрисована").toContain("Есептегіш");
    expect(текст.match(РУССКОЕ), "русское слово на kk").toBeNull();
  });
});

describe("сторож: pricing.* в kk не равны ru", () => {
  // Слова, одинаковые в казахском и русском (заимствования), и названия — не ошибка. Остальное без кириллицы
  // (бренды, числа, латиница) проверяется правилом «нет кириллицы».
  const ТЕ_ЖЕ = new Set([
    "pricing.admin.eduTab.domainColumn", "pricing.admin.table.company", "pricing.calculatorEmbed.fieldCurrency",
    "pricing.caseDetail.industry.media", "pricing.cases.industry.media", "pricing.compare.kind.core",
    "pricing.forIndustry.caseLabel", "pricing.glossary.category.auth", "pricing.partnersPortal.field.customer",
    "pricing.partnersPortal.table.customer", "pricing.roadmap.moduleCountOne", "pricing.security.residency.kz.region",
  ]);
  it("список совпадений короткий и без русских слов-меток", () => {
    const ru = ruDict as Record<string, string>;
    const kk = kkDictAll as Record<string, string>;
    const same = Object.keys(kk).filter((k) => k.startsWith("pricing.") && kk[k] === ru[k] && /[А-Яа-яЁё]/.test(kk[k]) && !ТЕ_ЖЕ.has(k));
    expect(same, "ключи pricing.* на kk совпали с русским").toEqual([]);
    expect(ТЕ_ЖЕ.size).toBeLessThan(15);
    expect(Object.keys(kk).filter((k) => k.startsWith("pricing.")).length, "прибор: ключи найдены").toBeGreaterThan(500);
  });
  it("kkDict страницы цен: нет значений, равных русским", () => {
    for (const [k, v] of Object.entries(PRICING_DICT.kk)) {
      const r = PRICING_DICT.ru[k];
      if (k === "modules.colModule") continue; // «Модуль» — то же слово по-казахски (см. pricingI18n)
      if (r && v === r && /[А-Яа-яЁё]/.test(v)) throw new Error(`pricingI18n kk.${k} = ru: ${v}`);
    }
  });
});
