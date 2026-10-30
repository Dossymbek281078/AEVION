/**
 * Плашка бюро и QRight называет бесплатную норму и что подписка её снимает.
 *
 * 🔴 30.10.2026, повод (замер на проде). На /bureau и /qright плашка говорила
 * «Входит в подписку AEVION · от $150/мес». Стены у этих модулей нет (доступ
 * открыт), подписка снимает только месячную норму «3 бесплатные регистрации»
 * (бэкенд freeActionQuota.ts, 402 free_quota_exceeded после третьей). Ни на
 * одной из двух страниц о пределе не было ни слова — человек узнавал о нём из
 * отказа после четвёртой работы.
 *
 * Проверяем: ru (без провайдера и с ним), en без кириллицы, kk — своя строка;
 * остальные модули плашки прежние («Входит в подписку AEVION»).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import ModulePricingChip from "../ModulePricingChip";
import { planetFromPerMonth } from "@/lib/termPricing";
import { FREE_ACTIONS_PER_MONTH } from "@/lib/freeActionQuota";
// Словари — только через localeSource (сторож app/__tests__/localeParity.guard: одна точка
// правки); i18n-data оттуда же не импортируем — тот же сторож ищет этот импорт в тестах.
import { allTranslations } from "../../app/__tests__/localeSource";

const kk = allTranslations().kk;
const ru = allTranslations().ru;
const interpolate = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((r, [k, v]) => r.split(`{${k}}`).join(String(v)), s);

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

function guest() {
  globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
}
function setLangCookie(lang: string | null) {
  document.cookie = lang ? `aevion_lang_v1=${lang}; path=/` : "aevion_lang_v1=; path=/; max-age=0";
}
function hasCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}

afterEach(() => {
  cleanup();
  setLangCookie(null);
  try { localStorage.clear(); } catch { /* окружение без хранилища */ }
  vi.restoreAllMocks();
});

describe("ModulePricingChip — бюро и QRight называют норму 3 и подписку", () => {
  it("знаменатель: норма из lib/freeActionQuota равна 3 (копия бэкенда)", () => {
    expect(FREE_ACTIONS_PER_MONTH).toBe(3);
  });

  // В заголовке нет знака доллара: it.each читает «$150» как подстановку и печатает undefined.
  it.each(["bureau", "qright"])("ru без провайдера (%s): «3 работы в месяц бесплатно · без предела — в подписке AEVION от 150/мес · Купить»", (moduleId) => {
    guest();
    const { container } = render(<ModulePricingChip moduleId={moduleId} />);
    const text = container.textContent ?? "";
    expect(text).toContain(`${FREE_ACTIONS_PER_MONTH} работы в месяц бесплатно`);
    expect(text).toContain(`без предела — в подписке AEVION от $${planetFromPerMonth()}/мес`);
    expect(text, "старая пустая формула осталась").not.toContain("Входит в подписку AEVION");
    expect(screen.getByText("Купить").closest("a")!.getAttribute("href")).toBe("/pricing#planet-buy");
  });

  it.each(["bureau", "qright"])("en (%s): «3 works a month free», без кириллицы", async (moduleId) => {
    guest();
    setLangCookie("en");
    const { container } = render(
      <I18nProvider>
        <ModulePricingChip moduleId={moduleId} />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText("Buy")).toBeTruthy());
    const text = container.textContent ?? "";
    expect(text).toContain(`${FREE_ACTIONS_PER_MONTH} works a month free`);
    expect(text).toContain(`no limit with the AEVION subscription from $${planetFromPerMonth()}/mo`);
    expect(hasCyrillic(text), `русское в английском чипе: ${text}`).toBe(false);
  });

  // kk-словарь в jsdom не догружается (loadDict идёт через сеть, а сеть здесь замокана),
  // поэтому казахский проверяем по словарю: ключи заведены, подстановка {n}/{price} цела.
  it("kk: ключи нормы заведены в словаре, своя строка, не английская и не русская", () => {
    const строка = interpolate(kk["moduleChip.freeQuota"], { n: FREE_ACTIONS_PER_MONTH });
    expect(строка).toBe(`айына ${FREE_ACTIONS_PER_MONTH} жұмыс тегін`);
    expect(строка).not.toContain("{n}");
    expect(строка).not.toBe(interpolate(ru["moduleChip.freeQuota"], { n: FREE_ACTIONS_PER_MONTH }));
    expect(kk["moduleChip.noLimitInPlanet"]).toContain("{price}");
    expect(kk["moduleChip.noLimitInPlanet"]).toContain("AEVION");
    expect(kk["moduleChip.noLimitInPlanet"]).not.toBe(ru["moduleChip.noLimitInPlanet"]);
  });

  it("контроль: у модуля без нормы (qlearn) формула прежняя", () => {
    guest();
    const { container } = render(<ModulePricingChip moduleId="qlearn" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Входит в подписку AEVION");
    expect(text).not.toContain("в месяц бесплатно");
  });
});
