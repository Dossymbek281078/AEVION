// Страница модуля открывается и показывает консоль.
//
// Проверка появилась 12.08.2026 вместе с удалением рабочего стола агентов —
// из файла ушло около 1600 строк, и «tsc чист + остальные тесты зелёные» это
// не измеряет: ни один из них страницу не монтирует. Здесь она монтируется
// целиком, с живыми дочерними компонентами.

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => false,
  getAuthHeaders: () => ({}),
}));

import MultichatEnginePage from "./MultichatEngineClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Страница мультичата", () => {
  test("монтируется и показывает рабочую консоль первой", async () => {
    // Полоса провайдеров и витрина пресетов ходят в сеть при монтировании.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ providers: [], presets: [] }) })) as unknown as typeof fetch,
    );

    render(<MultichatEnginePage />);

    // Консоль — то, ради чего модуль открывают: она обязана быть на экране,
    // а не за описанием возможностей.
    expect(await screen.findByText("Консилиум")).toBeTruthy();
    expect(screen.getByPlaceholderText(/стоит ли запускать платный тариф/i)).toBeTruthy();
    expect(screen.getByText("AEVION Multichat Engine")).toBeTruthy();
  });
});
