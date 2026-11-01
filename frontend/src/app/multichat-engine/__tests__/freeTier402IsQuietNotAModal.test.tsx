// 2.11.2026 (прод 5c84234b1, вошедший на free): /api/multichat/provider-status и /presets отвечают 402.
// Страница сама показывает «на платном тарифе» (gated), но глобальный перехватчик (lib/paywall.ts)
// на каждый 402 поднимает модалку тарифа — поверх бесплатного совета. Оба запроса идут «тихо»
// (ТИХАЯ_СТЕНА), страница остаётся рабочей и без красной ошибки.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ isAuthenticated: () => true, getAuthHeaders: () => ({}) }));

import MultichatEnginePage from "../MultichatEngineClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("вошедший на free: 402 от provider-status и presets", () => {
  test("оба запроса помечены тихими, а страница без красной ошибки и с консолью", async () => {
    const вызовы: Array<{ url: string; init?: RequestInit & { aevionPaywall?: string } }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        вызовы.push({ url, init: init as RequestInit & { aevionPaywall?: string } });
        if (url.includes("/api/multichat/provider-status") || url.includes("/api/multichat/presets")) {
          return { ok: false, status: 402, json: async () => ({ error: "upgrade_required" }) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }) as unknown as typeof fetch,
    );
    render(<MultichatEnginePage />);
    expect(await screen.findByText("Консилиум")).toBeTruthy();
    await waitFor(() => {
      expect(вызовы.some((в) => в.url.includes("/api/multichat/provider-status"))).toBe(true);
      expect(вызовы.some((в) => в.url.includes("/api/multichat/presets"))).toBe(true);
    });
    for (const в of вызовы.filter((x) => /provider-status|\/presets/.test(x.url))) {
      expect(в.init?.aevionPaywall, `${в.url}: без «тихо» перехватчик поднимет модалку тарифа`).toBe("silent");
    }
    expect(screen.queryByText(/unavailable: status 402/i)).toBeNull();
  });
});
