import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

import SharedConversationPage from "../shared/[token]/page";

// Публичная страница расшаренного консилиума — единственный экран модуля,
// который открывает посторонний. Проверяем то, что он увидит при отказе:
// раньше здесь было «Ошибка 429» — голый код, звучащий как вина читателя.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok-1" }),
}));

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Публичная ссылка на консилиум", () => {
  test("исчерпанный предел объяснён по-русски, а не кодом ответа", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "Too many requests" }, 429)));

    render(<SharedConversationPage />);

    expect(await screen.findByText(/общий предел, а не ваш личный/i)).toBeTruthy();
    // Именно этого не должно быть: голый код вместо объяснения.
    expect(screen.queryByText(/^Ошибка 429$/)).toBeNull();
  });

  test("отозванная ссылка объяснена отдельно от сбоя", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({}, 404)));

    render(<SharedConversationPage />);

    expect(await screen.findByText(/не найдена или была отозвана автором/i)).toBeTruthy();
  });

  test("беседа показывается с русскими подписями, без внутренних ярлыков", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        json({
          conversation: { id: "c1", title: "Стоит ли поднимать цену", createdAt: "2026-08-12T09:00:00.000Z" },
          turns: [
            { role: "user", content: "Стоит ли поднимать цену?", createdAt: "2026-08-12T09:00:00.000Z" },
            { role: "assistant", content: "Смотря на удержание.", conversationId: "c1:analyst" },
          ],
        }),
      ),
    );

    render(<SharedConversationPage />);

    await waitFor(() => expect(screen.getByText("Стоит ли поднимать цену")).toBeTruthy());
    expect(screen.getByText(/Агент: analyst/)).toBeTruthy();
    // Английские ярлыки прежней версии.
    expect(screen.queryByText(/PUBLIC SHARE/i)).toBeNull();
    expect(screen.queryByText(/^Agent: analyst$/)).toBeNull();
  });
});
