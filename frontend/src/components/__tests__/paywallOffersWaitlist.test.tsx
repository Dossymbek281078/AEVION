import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PaywallScreen } from "../PaywallScreen";

/**
 * Платная стена — самая частая точка ухода: её видит каждый, кто пришёл в
 * закрытый модуль без оплаты (19 страниц, замер 20.09.2026). Убрать оттуда
 * приём адреса легко и незаметно, поэтому он закреплён тестом.
 *
 * Контроль обратной стороны — в footerWaitlist.test.tsx: при чужом поле почты
 * блок обязан НЕ рисоваться. Здесь проверяется, что на голой стене он есть.
 */
vi.mock("next/navigation", () => ({ usePathname: () => "/qcoreai" }));

const payload = {
  error: "upgrade_required",
  module: "qcoreai",
  plan: "free",
  requiredTiers: ["medium", "full"],
  upgradeUrl: "/pricing#tiers",
  message: "Нужен тариф выше",
} as never;

describe("платная стена предлагает оставить адрес", () => {
  it("на стене есть и путь к тарифам, и приём адреса", async () => {
    vi.useFakeTimers();
    render(<PaywallScreen payload={payload} backHref="/modules" />);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    // Путь к оплате — главное, он обязан остаться на месте.
    expect(screen.getAllByText(/тариф/i).length, "исчезла ссылка на тарифы").toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).not.toBeNull());
  });
});
/*
 * 🔴 СТЕНА НЕ ИМЕЕТ ПРАВА НАЗЫВАТЬ ТАРИФ ДОРОЖЕ НУЖНОГО.
 *
 * Замер 08.10.2026 на проде: ручка отдаёт requiredTiers ["full","enterprise"] —
 * это КАНОНИЧЕСКИЕ тарифы, где "full" означает «любой платный срок»
 * (planGate.normalizeTier схлопывает lite/medium/pro/full/max/business → "full",
 * проверено в коде). Экран печатал их дословно, и гость читал «FULL / ENTERPRISE».
 * А в нашей лестнице сроков Full — это 9 месяцев. Человеку, которому хватает
 * Lite за 1 месяц, показывали девятимесячный план. Это последний экран
 * несостоявшегося покупателя, и он завышал цену входа.
 *
 * Охват беды: 16 страниц с PaywallScreen плюс PaywallModal.
 */
describe("стена называет самый дешёвый вход", () => {
  const прод = {
    error: "upgrade_required",
    module: "qnews",
    plan: "free",
    // Ровно то, что отдаёт прод (замер: /api/qnews/trending у гостя).
    requiredTiers: ["full", "enterprise"],
    upgradeUrl: "https://aevion.app/pricing",
    authState: "anonymous",
    loginUrl: "https://aevion.app/auth?next=%2Fqnews",
    message: "Если вы уже оплатили — войдите…",
  } as never;

  it("называет Lite как вход и не выдаёт «FULL» за требование", () => {
    const { container } = render(<PaywallScreen payload={прод} backHref="/modules" />);
    const текст = (container.textContent || "").replace(/\s+/g, " ");
    process.stderr.write(`[сторож] экран печатает: ${текст.slice(0, 220)}${String.fromCharCode(10)}`);

    expect(
      текст,
      "экран не называет Lite — гость не узнает, что хватает самого дешёвого срока",
    ).toMatch(/Lite/i);

    // «FULL» как ТРЕБОВАНИЕ — запрещено: столько платить не нужно.
    expect(
      /FULL/i.test(текст),
      "экран всё ещё называет требованием «FULL» — это 9 месяцев, а доступ даёт Lite",
    ).toBe(false);
  });

  it("КОНТРОЛЬ: текущий план гостя по-прежнему назван верно", () => {
    const { container } = render(<PaywallScreen payload={прод} backHref="/modules" />);
    const текст = (container.textContent || "").replace(/\s+/g, " ");
    // Подпись ПЛАНА — другой смысл, её ломать нельзя: гость на free.
    expect(текст, "пропала строка о текущем плане гостя").toMatch(/Free/i);
  });
});

