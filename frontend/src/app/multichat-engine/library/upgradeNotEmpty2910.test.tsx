// 29.10.2026, замер прода f4a0c073a: бесплатный вошедший сразу после беседы открыл /multichat-engine/library
// и увидел «Агент не ответил. Здесь пока пусто» — сервер ответил 402 upgrade_required (список — в подписке).
// Отказ должен называться отказом и вести к оплате; «пусто» — неправда.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MultichatLibraryPage from "./page";

function mockFetch(status: number, body: unknown) {
  const f = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal("fetch", f as unknown as typeof fetch);
  return f;
}
beforeEach(() => { localStorage.clear(); localStorage.setItem("aevion_auth_token_v1", "test.jwt.token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("библиотека бесед при 402 upgrade_required", () => {
  test("показывает подписку и ссылку на оплату, без «Агент не ответил» и без «пусто»", async () => {
    mockFetch(402, { error: "upgrade_required", requiredPlan: "AEVION Планета (любой срок)", upgradeUrl: "https://aevion.app/pricing?app=multichat-engine" });
    render(<MultichatLibraryPage />);
    await waitFor(() => expect(screen.getByText(/История бесед — в подписке «AEVION Планета \(любой срок\)»/)).toBeTruthy());
    const a = screen.getByText("Подключить подписку").closest("a");
    expect(a?.getAttribute("href")).toBe("https://aevion.app/pricing?app=multichat-engine");
    expect(screen.queryByText(/Агент не ответил/)).toBeNull();
    expect(screen.queryByText(/Здесь пока пусто/)).toBeNull();
  });

  test("КОНТРОЛЬ: настоящий сбой (500) по-прежнему показан ошибкой, а не подпиской", async () => {
    mockFetch(500, { error: "list failed" });
    render(<MultichatLibraryPage />);
    await waitFor(() => expect(screen.getByText(/Агент не ответил|ответил ошибкой|не ответил/)).toBeTruthy());
    expect(screen.queryByText("Подключить подписку")).toBeNull();
    expect(screen.queryByText(/Здесь пока пусто/)).toBeNull();
  });

  test("пустой список у подписчика — «Здесь пока пусто» остаётся", async () => {
    mockFetch(200, { items: [] });
    render(<MultichatLibraryPage />);
    await waitFor(() => expect(screen.getByText(/Здесь пока пусто/)).toBeTruthy());
  });
});
