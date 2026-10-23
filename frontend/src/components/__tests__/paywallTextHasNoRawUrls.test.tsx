import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PaywallModal } from "../PaywallModal";
import { PAYWALL_EVENT, type PaywallEventDetail } from "@/lib/paywall";

vi.setConfig({ testTimeout: 20_000 });

// 24.10.2026, кадр прода 390 на /qfusionai: в окне стоял текст ответа 402 для
// API-клиентов — «…доступ откроется: https://aevion.app/auth?next=%2Fqfusionai.
// Если ещё нет — модуль «qfusionai» входит в план…: https://aevion.app/pricing».
// Те же два действия в окне — кнопки; сырые адреса человеку не нужны.
const ОТВЕТ: PaywallEventDetail = {
  error: "upgrade_required",
  module: "qfusionai",
  plan: "free",
  requiredTiers: ["full", "enterprise"],
  upgradeUrl: "https://aevion.app/pricing",
  authState: "anonymous",
  message:
    "Если вы уже оплатили — войдите под почтой, которой платили, и доступ откроется: https://aevion.app/auth?next=%2Fqfusionai. " +
    "Если ещё нет — модуль «qfusionai» входит в план «AEVION Планета» (любой срок): https://aevion.app/pricing",
} as PaywallEventDetail;

afterEach(cleanup);

describe("текст стены — без сырых адресов и служебных имён", () => {
  it("гость видит человеческий текст, ссылка на оплату — на кнопке", () => {
    render(<PaywallModal />);
    act(() => { window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: { ...ОТВЕТ, userInitiated: true } })); });
    const окно = screen.getByRole("dialog");
    expect(окно.textContent, "знаменатель: окно открыто").toContain("Доступно на платном тарифе");
    expect(окно.textContent).not.toMatch(/https?:\/\//);
    expect(окно.textContent).not.toContain("«qfusionai»");
    expect(окно.textContent).toContain("AEVION Планета");
    expect(document.querySelector('a[href="https://aevion.app/pricing"]'), "кнопка к тарифам пропала").not.toBeNull();
  });
  it("сообщение без адресов показывается как есть", () => {
    render(<PaywallModal />);
    act(() => { window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: { ...ОТВЕТ, message: "Особый текст стены.", userInitiated: true } })); });
    expect(screen.getByRole("dialog").textContent).toContain("Особый текст стены.");
  });
});
