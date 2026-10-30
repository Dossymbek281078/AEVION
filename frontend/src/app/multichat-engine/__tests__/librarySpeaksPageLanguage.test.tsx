// Библиотека бесед на /en: интерфейс, ошибки и пустое состояние без кириллицы.
// Замер 30.10.2026: «Войдите, чтобы увидеть свои беседы…», «Не удалось получить список…»,
// «Здесь пока пусто.», кнопки строки беседы и alert/confirm были русскими на английской странице.
// Название тарифа «AEVION Планета» — имя продукта, его оставляем.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: "en", t: (k: string) => k }),
}));

import MultichatLibraryPage from "../library/page";
import { setAuthToken, clearAuthToken } from "@/lib/auth";

vi.setConfig({ testTimeout: 20_000 });

const БЕЗ_КИРИЛЛИЦЫ = /[А-Яа-яЁё]/;
const текст = () => (document.body.textContent ?? "").replace(/AEVION Планета/g, "");

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => {
  cleanup();
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("библиотека бесед на /en", () => {
  test("вход, сбой сети, пусто, беседа — без кириллицы", async () => {
    render(<MultichatLibraryPage />);
    expect(текст(), текст()).not.toMatch(БЕЗ_КИРИЛЛИЦЫ);
    expect(document.body.textContent).toContain("Sign in");
    cleanup();

    setAuthToken("jwt-test");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    render(<MultichatLibraryPage />);
    await screen.findByText(/Could not get the list/);
    expect(текст(), текст()).not.toMatch(БЕЗ_КИРИЛЛИЦЫ);
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => json({ items: [] })));
    render(<MultichatLibraryPage />);
    await screen.findByText(/Nothing here yet/);
    expect(текст(), текст()).not.toMatch(БЕЗ_КИРИЛЛИЦЫ);
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => json({ error: "upgrade_required", upgradeUrl: "/pricing" }, 402)));
    render(<MultichatLibraryPage />);
    await screen.findByText(/Conversation history is in the subscription/);
    expect(текст(), текст()).not.toMatch(БЕЗ_КИРИЛЛИЦЫ);
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => json({
      items: [{ id: "c1", title: "Pricing", shareToken: "abcdefghijklmnop", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" }],
    })));
    render(<MultichatLibraryPage />);
    await waitFor(() => expect(document.body.textContent).toContain("Pricing"));
    expect(текст(), текст()).not.toMatch(БЕЗ_КИРИЛЛИЦЫ);
    expect(document.body.textContent).toContain("Revoke link");
  });
});
