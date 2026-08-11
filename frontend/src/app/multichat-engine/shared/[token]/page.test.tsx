// Публичный просмотр беседы — что видит получатель ссылки.
//
// Экран самый внешний: его открывает человек без аккаунта, и часто это первое,
// что он видит про AEVION. Поэтому проверяется не «страница отрисовалась», а
// то, ради чего её открыли: виден вопрос, видны ответы ВСЕХ агентов, и видно,
// если кто-то из них не ответил.
//
// Последнее — не мелочь. Не ответивший агент приходит в ленте системной
// репликой; если её не показать, на его месте будет пустота, и читатель
// решит, что агентов было меньше, чем на самом деле. Ровно так и молчали бы
// три четверти сегодняшних дефектов: не ошибкой, а недосказанностью.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "mcs_test" }) }));

import SharedConversationPage from "./page";

const ISO = "2026-08-11T09:00:00.000Z";

function mockShared(turns: Array<Record<string, unknown>>) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      conversation: { id: "conv_1", title: "Стоит ли запускать платный тариф?", createdAt: ISO },
      turns,
    }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Публичный просмотр беседы", () => {
  beforeEach(() => {
    mockShared([
      { role: "user", content: "Стоит ли запускать платный тариф до первой продажи?", createdAt: ISO, conversationId: "conv_1" },
      { role: "assistant", content: "Выборки не хватит, вывод будет шумом.", createdAt: ISO, conversationId: "conv_1:analyst" },
      { role: "assistant", content: "Вопрос поставлен неверно: тариф — обязательство.", createdAt: ISO, conversationId: "conv_1:skeptic" },
      { role: "system", content: "[no-reply] агент не ответил", createdAt: ISO, conversationId: "conv_1:practic" },
    ]);
  });

  test("виден вопрос и ответы всех агентов", async () => {
    render(<SharedConversationPage />);

    expect(await screen.findByText(/Стоит ли запускать платный тариф до первой продажи/)).toBeTruthy();
    expect(screen.getByText(/Выборки не хватит/)).toBeTruthy();
    expect(screen.getByText(/тариф — обязательство/)).toBeTruthy();
  });

  test("агенты подписаны — иначе непонятно, чей это ответ", async () => {
    render(<SharedConversationPage />);

    await waitFor(() => expect(screen.getByText("analyst")).toBeTruthy());
    expect(screen.getByText("skeptic")).toBeTruthy();
    expect(screen.getByText("practic")).toBeTruthy();
  });

  test("не ответивший агент показан прямо, а не пустотой", async () => {
    render(<SharedConversationPage />);

    // Именно текст, а не сырая системная реплика с префиксом [no-reply].
    expect(await screen.findByText("агент не ответил")).toBeTruthy();
    expect(screen.queryByText(/\[no-reply\]/)).toBeNull();
  });
});

describe("Публичный просмотр: ссылка недоступна", () => {
  test("отозванная ссылка объясняет причину, а не показывает пустой экран", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch,
    );

    render(<SharedConversationPage />);

    expect(await screen.findByText(/Ссылка недоступна/)).toBeTruthy();
    expect(screen.getByText(/не найдена или была отозвана/)).toBeTruthy();
  });
});
