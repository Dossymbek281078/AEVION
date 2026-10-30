import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 ПЕРВЫЙ КАДР /pricing — НА ЯЗЫКЕ ГОСТЯ, ДЛЯ РУССКОГО — РУССКИЙ СРАЗУ.
 *
 * Замер Науки 30.10.2026: I18nProvider до langReady держит "en", и русский гость
 * видел английский кадр. pricing/layout.tsx выбирает язык на сервере (serverLang:
 * кука → Accept-Language → ru) и кладёт его в ServerLangProvider; страница и
 * usePricingT берут его, пока язык не определён. Первый кадр страницы цен —
 * строка загрузки (данные приходят с клиента), по ней и проверяем язык.
 */

const lang = vi.hoisted(() => ({ value: "ru" as "ru" | "en" | "kk" }));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("@/lib/i18n-server", () => ({ getServerLang: async () => "ru" }));
vi.mock("@/lib/appsJsonLd", () => ({
  разметкаПриложений: async () => null,
  оплачиваемыеПриложения: async () => [],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/pricing",
}));

// eslint-disable-next-line import/first
import PricingLayout from "../layout";
// eslint-disable-next-line import/first
import PricingPage from "../page";
// eslint-disable-next-line import/first
import { pricingDictFor } from "@/lib/pricingI18n";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

async function кадр(l: "ru" | "en" | "kk") {
  lang.value = l;
  // Ответ не приходит никогда — страница остаётся в первом кадре (строка загрузки).
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
  const дерево = await PricingLayout({ children: <PricingPage /> });
  // Серверная отрисовка: эффекты не идут, I18nProvider остаётся на "en" и langReady=false — ровно первый кадр.
  const div = document.createElement("div");
  div.innerHTML = renderToString(<I18nProvider>{дерево}</I18nProvider>);
  return { container: div };
}

describe("макет /pricing решает язык на сервере (сторож)", () => {
  it("🔴 layout.tsx зовёт serverLang, оборачивает в ServerLangProvider и рисуется на каждый запрос", () => {
    const макет = readFileSync(join(process.cwd(), "src/app/pricing/layout.tsx"), "utf8");
    expect(макет).toContain('await serverLang("ru")');
    expect(макет).toContain("<ServerLangProvider lang={langFrame}>");
    expect(макет).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("первый кадр /pricing идёт на языке сервера", () => {
  it("🔴 сервер дал ru, провайдера нет — русская строка загрузки и маркер lang=ru", async () => {
    const { container } = await кадр("ru");
    const маркер = container.querySelector("[data-server-lang]");
    expect(маркер?.getAttribute("data-server-lang")).toBe("ru");
    expect(маркер?.getAttribute("lang")).toBe("ru");
    expect(container.textContent).toContain(pricingDictFor("ru")["loading.pricing"]);
    expect(container.textContent).not.toContain(pricingDictFor("en")["loading.pricing"]);
  });

  it("сервер дал en — английская строка загрузки", async () => {
    const { container } = await кадр("en");
    expect(container.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
    expect(container.textContent).toContain(pricingDictFor("en")["loading.pricing"]);
    expect(container.textContent).not.toContain(pricingDictFor("ru")["loading.pricing"]);
  });
});
