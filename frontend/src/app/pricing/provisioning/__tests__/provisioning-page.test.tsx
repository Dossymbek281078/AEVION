import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/i18n", () => ({
  // Ключ как текст: проверяем поведение и ВЫБОР ключа, а не перевод.
  useI18n: () => ({ t: (k: string) => k }),
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => `http://backend${p}` }));

import ProvisioningPage from "../page";

const fetchMock = vi.fn();

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "/pricing/provisioning");
  // Агрегат подтягивается на mount и к делу не относится.
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ total: 0, byTier: {}, last7d: 0, trialsActive: 0, recent: [] }),
  });
});

describe("/pricing/provisioning", () => {
  it("по кнопке просит ссылку на почту и НЕ тянет чужую историю", async () => {
    render(<ProvisioningPage />);

    await userEvent.type(screen.getByLabelText(/emailLabel/), "buyer@example.com");
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await userEvent.click(screen.getByRole("button", { name: /sendLink/ }));

    await waitFor(() => expect(screen.getByText(/linkSent.title/)).toBeTruthy());

    // Главное утверждение: истории по одному адресу страница не запрашивает —
    // иначе покупки любого человека доставались бы тому, кто знает его почту.
    const historyCalls = fetchMock.mock.calls.filter((c) => urlOf(c).includes("/history"));
    expect(historyCalls).toHaveLength(0);
    expect(fetchMock.mock.calls.some((c) => urlOf(c).includes("/magic-link"))).toBe(true);
  });

  it("по ссылке из письма открывает историю сразу", async () => {
    window.history.replaceState(
      {},
      "",
      "/pricing/provisioning?email=buyer%40example.com&token=deadbeef",
    );

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/history")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: "b****@example.com",
            count: 1,
            truncated: false,
            items: [{
              id: "s1", ts: "2026-08-09T10:00:00.000Z", tierId: "full", period: "monthly",
              seats: 1, modules: [], trialDays: 0, validUntil: null, amountUsd: 49,
              promoCode: null, source: null, daysLeft: null, status: "active",
              emailMasked: "b****@example.com",
            }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ total: 0, byTier: {}, last7d: 0, trialsActive: 0, recent: [] }) };
    });

    render(<ProvisioningPage />);

    await waitFor(() =>
      expect(screen.getAllByText(/b\*+@example\.com/).length).toBeGreaterThan(0),
    );

    const call = fetchMock.mock.calls.find((c) => urlOf(c).includes("/history"));
    expect(urlOf(call!)).toContain("token=deadbeef");
  });
});
