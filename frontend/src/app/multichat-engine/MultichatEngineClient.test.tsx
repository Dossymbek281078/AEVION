// Страница модуля открывается и показывает консоль.
//
// Проверка появилась 12.08.2026 вместе с удалением рабочего стола агентов —
// из файла ушло около 1600 строк, и «tsc чист + остальные тесты зелёные» это
// не измеряет: ни один из них страницу не монтирует. Здесь она монтируется
// целиком, с живыми дочерними компонентами.

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
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

// Полоса поставщиков утверждала то, чего не измеряла.
//
// Она берёт данные из /api/multichat/provider-status, а тот — из
// /api/qcoreai/providers. Последний СИНХРОННЫЙ: читает переменные окружения и
// перечисляет провайдеров, у которых задан ключ. Никакого обращения к
// Anthropic, OpenAI и остальным там нет ни одной строкой.
//
// А на экране при этом горел зелёный огонёк, слово «online» и правдоподобная
// задержка «3ms». Задержка — это время ответа НАШЕГО же localhost, поданное
// как задержка провайдера, с порогами «⚠ >250ms» и «🐢 >1000ms». Если бы
// OpenAI лежал, страница всё равно писала бы «online».
//
// Наличие ключа — полезный факт, и показывать его надо. Врать про
// доступность — нет.
describe("Полоса поставщиков — говорит только то, что измеряет", () => {
  function stubProviders() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("provider-status")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              providers: [
                { id: "anthropic", name: "Anthropic", configured: true, reachable: true, latencyMs: 3, defaultModel: "claude-sonnet-4-6" },
                { id: "openai", name: "OpenAI", configured: false, reachable: false, latencyMs: null, defaultModel: null },
              ],
              cachedAt: "2026-08-12T05:00:00.000Z",
              probed: false,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ presets: [] }) };
      }) as unknown as typeof fetch,
    );
  }

  test("вместо «online» — «ключ настроен», без выдуманной задержки", async () => {
    stubProviders();
    render(<MultichatEnginePage />);

    expect(await screen.findByText(/ключ настроен/i)).toBeTruthy();
    expect(screen.queryByText("online")).toBeNull();
    // «3ms» — это наш собственный localhost, а не Anthropic.
    expect(screen.queryByText(/3ms/)).toBeNull();
  });

  test("сказано прямо, что доступность самих поставщиков не проверяется", async () => {
    stubProviders();
    render(<MultichatEnginePage />);

    expect(await screen.findByText(/доступность.*не провер/i)).toBeTruthy();
  });

  test("провайдер без ключа так и назван", async () => {
    stubProviders();
    render(<MultichatEnginePage />);

    expect(await screen.findByText(/ключа нет/i)).toBeTruthy();
  });
});
