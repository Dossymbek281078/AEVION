import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { I18nProvider } from "@/lib/i18n";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";

/**
 * 🔴 ПЕРВЫЙ КАДР ГЛАВНОЙ «/» — НА ЯЗЫКЕ ГОСТЯ.
 *
 * Замер Приложений 30.10.2026 18:38 (прод 4f71ad70f, ru-RU): сырой HTML «/» — английский h1
 * «Describe it in a sentence…», русский через ~6 с. app/page.tsx решает язык на сервере
 * (serverLang) и кладёт его в ServerLangProvider + строки home.* в ServerFrameTextProvider;
 * _home.tsx до langReady берёт их. Отрисовка: I18nProvider на SSR остаётся "en" и
 * langReady=false — ровно первый кадр.
 */

const lang = vi.hoisted(() => ({ value: "ru" as "ru" | "en" | "kk" }));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("@/lib/channelNow", () => ({ channelNow: () => "youtube", сыраяМеткаКанала: () => "yt-devhub-2min" }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("../components/PlanetPulse", () => ({ PlanetPulse: () => null }));
vi.mock("@/components/ConstitutionEmbed", () => ({ ConstitutionEmbed: () => null }));
vi.mock("@/components/WaitlistCapture", () => ({ WaitlistCapture: () => null }));
vi.mock("@/components/PageTracking", () => ({ PageTracking: () => null }));
vi.mock("@/lib/planetData", () => ({ fetchPlanetStats: async () => null, fetchRecentArtifacts: async () => null }));

// eslint-disable-next-line import/first
import Page from "../page";

afterEach(() => vi.unstubAllGlobals());

async function кадр(l: "ru" | "en" | "kk") {
  lang.value = l;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
  const div = document.createElement("div");
  div.innerHTML = renderToString(<I18nProvider>{await Page()}</I18nProvider>);
  return div;
}

describe("главная «/» решает язык на сервере (сторож)", () => {
  it("🔴 page.tsx зовёт serverLang(ru), оборачивает в провайдеры и рисуется на каждый запрос", () => {
    const src = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(src).toContain('await serverLang("ru")');
    expect(src).toContain("<ServerLangProvider lang={lang} frameStrings={строкиКадра(lang, КЛЮЧИ_ГЛАВНОЙ)}>");
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("первый кадр «/» идёт на языке сервера", () => {
  it("🔴 ru: русский h1, подзаголовок, кнопка DevHub, ссылка «Цены»; маркер data-server-lang=ru", async () => {
    const d = await кадр("ru");
    expect(d.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("ru");
    expect(d.querySelector("h1")?.textContent).toBe(ru["home.title"]);
    expect(d.textContent).toContain(ru["home.subtitle"]);
    expect(d.querySelector('[data-testid="home-primary-cta"]')?.textContent).toBe(ru["home.cta.devhub"]);
    expect(d.querySelector('[data-testid="home-first-links"]')?.textContent).toContain(ru["constitution.nav.pricing"]);
    expect(d.textContent).not.toContain(en["home.title"]);
    expect(d.textContent).not.toContain(en["home.cta.devhub"]);
  });

  it("en: английский h1 и кнопка, русских строк нет", async () => {
    const d = await кадр("en");
    expect(d.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
    expect(d.querySelector("h1")?.textContent).toBe(en["home.title"]);
    expect(d.querySelector('[data-testid="home-primary-cta"]')?.textContent).toBe(en["home.cta.devhub"]);
    expect(d.textContent).not.toContain(ru["home.title"]);
    expect(d.textContent).not.toContain(ru["home.cta.devhub"]);
  });
});
