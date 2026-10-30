import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PaywallScreen } from "../PaywallScreen";
import type { PaywallPayload } from "@/lib/paywall";

vi.setConfig({ testTimeout: 20_000 });

/**
 * Серверная стена закрытых модулей на языке страницы (30.10.2026, окно
 * Приложения-2·Бюро).
 *
 * Поломка: PaywallScreen рисуют 17 страниц (qcoreai, multichat-engine, qai,
 * healthai, qfusionai…), и все подписи были зашиты по-русски для любого языка:
 * английский гость закрытого модуля читал «Перейти к тарифам →», «Уже оплатили?»,
 * «Этот модуль входит в любую платную подписку». Это точка оплаты en-канала —
 * тот же класс беды, что у PaywallModal (fix/paywall-modal-lang-3010).
 *
 * Язык: из I18nProvider, а вне провайдера (здесь) — из document.lang, как у
 * модалки. Контроль: без языка — прежний русский текст.
 */

const БАЗА: PaywallPayload = {
  error: "upgrade_required",
  module: "qcoreai",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  message: "Модуль «qcoreai» доступен на тарифах: full, enterprise.",
};

const ГОСТЬ: PaywallPayload = {
  ...БАЗА,
  authState: "anonymous",
  loginUrl: "https://aevion.app/auth?next=%2Fqcoreai",
};

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
});

describe("PaywallScreen на языке страницы", () => {
  it("en: заголовок, план, кнопки и подвал — по-английски, кириллицы в экране нет", () => {
    document.documentElement.lang = "en";
    const { container } = render(<PaywallScreen payload={ГОСТЬ} backHref="/modules" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This module is part of any paid plan");
    expect(screen.getByText(/Go to pricing/)).toBeTruthy();
    expect(screen.getByText(/Sign in with the payment email/)).toBeTruthy();
    expect(screen.getByText(/Check your subscription status/)).toBeTruthy();
    expect(screen.getByText(/12-month commitment/)).toBeTruthy();
    expect(screen.getByText(/← Home/)).toBeTruthy();
    const текст = container.textContent ?? "";
    expect(текст).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("kk: заголовок и кнопка к тарифам — по-казахски", () => {
    document.documentElement.lang = "kk";
    render(<PaywallScreen payload={БАЗА} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Бұл модуль кез келген ақылы жазылымға кіреді");
    expect(screen.getByText(/Тарифтерге өту/)).toBeTruthy();
    expect(screen.queryByText(/Перейти к тарифам/)).toBeNull();
  });

  it("ru: прежний текст", () => {
    document.documentElement.lang = "ru";
    render(<PaywallScreen payload={БАЗА} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Этот модуль входит в любую платную подписку");
    expect(screen.getByText(/Перейти к тарифам/)).toBeTruthy();
    expect(screen.getByText(/Проверьте статус подписки/)).toBeTruthy();
  });

  it("КОНТРОЛЬ: без языка документа — русский, как прежде; явный backLabel сильнее словаря", () => {
    render(<PaywallScreen payload={БАЗА} backLabel="← В модуль" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Этот модуль входит в любую платную подписку");
    expect(screen.getByText("← В модуль")).toBeTruthy();
  });

  it("старшие тарифы (без full): второй заголовок тоже по языку", () => {
    document.documentElement.lang = "en";
    render(<PaywallScreen payload={{ ...БАЗА, requiredTiers: ["enterprise"] }} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This module is available on higher plans");
  });
});
