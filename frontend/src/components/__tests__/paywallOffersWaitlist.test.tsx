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
