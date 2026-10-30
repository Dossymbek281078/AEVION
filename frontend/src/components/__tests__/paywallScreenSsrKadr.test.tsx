import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { PaywallScreen } from "../PaywallScreen";
import type { PaywallPayload } from "@/lib/paywall";

/**
 * SSR-кадр платной стены на языке, выбранном сервером (30.10.2026, замечание
 * Продукта к fix/paywall-screen-lang-3010).
 *
 * I18nProvider стартует с «en» и определяет язык уже в браузере. Если стена
 * берёт язык только из него, SSR-HTML для русского гостя /qcoreai, /healthai,
 * /multichat-engine… английский, а после гидрации перерисовывается по-русски —
 * вспышка ровно перед оплатой. Макет маршрута кладёт серверный язык в
 * ServerLangProvider, и стена берёт его, пока провайдер не готов (языкКадра).
 *
 * Здесь — renderToString, как на сервере: эффекты не выполняются, langReady
 * остаётся false, и виден именно первый кадр.
 */

const ПЛАТЁЖ: PaywallPayload = {
  error: "upgrade_required",
  module: "qcoreai",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  message: "Модуль «qcoreai» доступен на тарифах: full, enterprise.",
  authState: "anonymous",
  loginUrl: "https://aevion.app/auth?next=%2Fqcoreai",
};

const АНГЛИЙСКИЕ = /Go to pricing|Already paid|paid plan|Sign in with the payment email|Home</;
const РУССКИЕ = /Перейти к тарифам|Уже оплатили|платную подписку|Войти под почтой оплаты/;

function текст(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function ssr(серверный: "ru" | "en" | "kk" | null): string {
  const экран = <PaywallScreen payload={ПЛАТЁЖ} backHref="/modules" />;
  return renderToString(
    <I18nProvider>
      {серверный ? <ServerLangProvider lang={серверный}>{экран}</ServerLangProvider> : экран}
    </I18nProvider>,
  );
}

describe("SSR-кадр PaywallScreen под макетом с серверным языком", () => {
  it("ru: в HTML русские строки стены и ни одной английской", () => {
    const html = ssr("ru");
    expect(html).toContain('data-server-lang="ru"');
    expect(html).toMatch(/Этот модуль входит в любую платную подписку/);
    expect(html).toMatch(/Перейти к тарифам/);
    expect(html).toMatch(/Уже оплатили\?/);
    expect(html).toMatch(/Войти под почтой оплаты/);
    expect(текст(html)).not.toMatch(АНГЛИЙСКИЕ);
  });

  it("en: английские строки, кириллицы в тексте нет", () => {
    const html = ssr("en");
    expect(html).toMatch(/This module is part of any paid plan/);
    expect(html).toMatch(/Go to pricing/);
    expect(текст(html)).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("kk: казахские строки", () => {
    const html = ssr("kk");
    expect(html).toMatch(/Бұл модуль кез келген ақылы жазылымға кіреді/);
    expect(html).toMatch(/Тарифтерге өту/);
    expect(текст(html)).not.toMatch(РУССКИЕ);
  });

  it("КОНТРОЛЬ: без серверного макета SSR идёт с языка провайдера (en) — потому макеты обязательны", () => {
    const html = ssr(null);
    expect(html).not.toContain("data-server-lang");
    expect(html).toMatch(/Go to pricing/);
  });
});
