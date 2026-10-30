import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { I18nProvider } from "@/lib/i18n";
import { useFrameT } from "@/lib/serverFrameText";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";

/**
 * 🔴 /pricing: t() ИЗ I18nProvider ДО ЗАГРУЗКИ СЛОВАРЯ НЕ ДОЛЖЕН БЫТЬ АНГЛИЙСКИМ ДЛЯ РУССКОГО ГОСТЯ.
 *
 * После ветки первого кадра строки tp() уже шли на языке сервера, а 101 вызов t() давал en
 * («Free», «On request», …) — смесь ru/en. Макет кладёт pricing.home.* и pricing.term.* на
 * языке кадра в ServerFrameTextProvider; страница берёт t = useFrameT().
 */

const lang = vi.hoisted(() => ({ value: "ru" as "ru" | "en" | "kk" }));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("@/lib/i18n-server", () => ({ getServerLang: async () => "ru" }));
vi.mock("@/lib/appsJsonLd", () => ({
  разметкаПриложений: async () => null,
  оплачиваемыеПриложения: async () => [],
}));

// eslint-disable-next-line import/first
import PricingLayout from "../layout";

const ПРОВЕРЯЕМЫЕ = [
  "pricing.home.price.free", // «Free» / «Бесплатно»
  "pricing.home.price.onRequest", // «On request» / «По запросу»
  "pricing.home.tier.notSellable",
  "pricing.home.tier.notSellableCta",
  "pricing.home.tier.openingCheckout",
  "pricing.home.apps.perYear",
  "pricing.home.heroModule.perMonth",
  "pricing.home.heroModule.usdNote",
  "pricing.term.month.one",
  "pricing.term.month.many",
];

function Зонд() {
  const t = useFrameT();
  return <ul>{ПРОВЕРЯЕМЫЕ.map((k) => <li key={k} data-k={k}>{t(k)}</li>)}</ul>;
}

async function кадр(l: "ru" | "en" | "kk") {
  lang.value = l;
  const div = document.createElement("div");
  div.innerHTML = renderToString(<I18nProvider>{await PricingLayout({ children: <Зонд /> })}</I18nProvider>);
  return div;
}

describe("серверный язык для t() на /pricing", () => {
  it("🔴 ru: все проверяемые ключи — русские, английских значений нет", async () => {
    const d = await кадр("ru");
    for (const k of ПРОВЕРЯЕМЫЕ) {
      const текст = d.querySelector(`[data-k="${k}"]`)?.textContent;
      expect(текст, k).toBe(ru[k]);
      if (en[k] !== ru[k]) expect(текст, `${k}: английский`).not.toBe(en[k]);
    }
    expect(ru["pricing.home.price.free"]).not.toBe(en["pricing.home.price.free"]); // контроль прибора
  });

  it("en: английские значения, русских нет", async () => {
    const d = await кадр("en");
    for (const k of ПРОВЕРЯЕМЫЕ) {
      const текст = d.querySelector(`[data-k="${k}"]`)?.textContent;
      expect(текст, k).toBe(en[k]);
      if (en[k] !== ru[k]) expect(текст, `${k}: русский`).not.toBe(ru[k]);
    }
  });

  it("страница берёт t из useFrameT, а не из useI18n (иначе до словаря снова en)", () => {
    const src = readFileSync(join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");
    expect(src).toContain("const t = useFrameT();");
    expect(src).not.toMatch(/const \{ t \} = i18n;/);
  });
});
