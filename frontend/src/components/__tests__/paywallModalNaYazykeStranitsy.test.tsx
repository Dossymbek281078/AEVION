import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PaywallModal } from "../PaywallModal";
import { PAYWALL_EVENT, type PaywallEventDetail } from "@/lib/paywall";

vi.setConfig({ testTimeout: 20_000 });

/**
 * Поломка с прода 30.10.2026: гость на английской странице /qright?lang=en
 * (html lang="en") после 4-й регистрации получал модалку PaywallModal целиком
 * по-русски: заголовок, текст, чип «Открывает: план «AEVION Планета»…», кнопки.
 * Это точка оплаты — английский канал терял покупателя. Модалка должна
 * говорить на языке страницы (ru/en/kk); без языка — прежнее русское поведение.
 */

const ГОСТЬ: PaywallEventDetail = {
  error: "upgrade_required",
  module: "qright",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  message: "Лимит исчерпан, оформить: https://aevion.app/pricing",
  authState: "anonymous",
  loginUrl: "https://aevion.app/auth?next=%2Fqright",
  userInitiated: true,
};

function fire(detail: PaywallEventDetail) {
  act(() => {
    window.dispatchEvent(new CustomEvent<PaywallEventDetail>(PAYWALL_EVENT, { detail }));
  });
}

function открыть(lang: string): HTMLElement {
  document.documentElement.lang = lang;
  render(<PaywallModal />);
  fire(ГОСТЬ);
  return screen.getByRole("dialog");
}

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
});

describe("PaywallModal — язык страницы", () => {
  it("en: вся модалка по-английски, кириллицы нет", () => {
    const dialog = открыть("en");
    const text = dialog.textContent ?? "";
    expect(text).toContain("Available on a paid plan");
    expect(text).toContain("Go to pricing");
    expect(text).toContain("Sign in with the payment email");
    expect(text).toContain("Later");
    expect(text).toContain("Opens with:");
    expect(text).toContain("12-month commitment");
    expect(text).not.toMatch(/[А-Яа-яЁё]/);
    expect(dialog.getAttribute("aria-label")).toBe("Paid plan required");
  });

  it("kk: заголовок и кнопка на казахском", () => {
    const text = открыть("kk").textContent ?? "";
    expect(text).toContain("Ақылы жоспарда қолжетімді");
    expect(text).toContain("Тарифтерге өту");
  });

  it.each(["ru", ""])("lang=%j: прежнее русское поведение", (lang) => {
    const text = открыть(lang).textContent ?? "";
    expect(text).toContain("Доступно на платном тарифе");
    expect(text).toContain("Перейти к тарифам");
  });
});
