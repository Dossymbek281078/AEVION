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

// Длинная беседа приезжает в ленту не целиком: сервер отдаёт последние 200
// реплик и говорит об этом полями totalTurns/truncated. Отсюда две вещи,
// которые обязана делать страница.
describe("Публичный просмотр: беседа показана не целиком", () => {
  function mockWindow(turns: Array<Record<string, unknown>>, totalTurns: number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          conversation: { id: "conv_1", title: "Длинная беседа", createdAt: ISO },
          turns,
          totalTurns,
          truncated: true,
        }),
      })) as unknown as typeof fetch,
    );
  }

  test("сказано, что видна только часть разговора", async () => {
    mockWindow(
      [
        { role: "user", content: "Последний вопрос", createdAt: ISO, conversationId: "conv_1" },
        { role: "assistant", content: "Последний ответ", createdAt: ISO, conversationId: "conv_1:analyst" },
      ],
      620,
    );

    render(<SharedConversationPage />);

    // Без этой строки получатель ссылки уверен, что видит разговор целиком.
    expect(await screen.findByText(/620/)).toBeTruthy();
  });

  test("ответы стоят под своим вопросом, когда окно разрезало круг", async () => {
    // Окно начинается с ответа на вопрос, который в него уже не попал.
    mockWindow(
      [
        { role: "assistant", content: "Ответ на прошлый вопрос", createdAt: "2026-08-11T08:00:00.000Z", conversationId: "conv_1:analyst" },
        { role: "user", content: "Новый вопрос", createdAt: "2026-08-11T09:00:00.000Z", conversationId: "conv_1" },
        { role: "assistant", content: "Ответ на новый вопрос", createdAt: "2026-08-11T09:00:01.000Z", conversationId: "conv_1:analyst" },
      ],
      620,
    );

    render(<SharedConversationPage />);

    await screen.findByText("Новый вопрос");
    // Раскладка по порядковому номеру ставила под «Новый вопрос» ответ из
    // предыдущего круга — читатель видел чужой ответ и не мог этого заметить.
    expect(screen.getByText("Ответ на новый вопрос")).toBeTruthy();
    expect(screen.queryByText("Ответ на прошлый вопрос")).toBeNull();
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
