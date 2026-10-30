// Публичная страница беседы на /en: ни одной кириллической буквы в интерфейсе.
// Замер 30.10.2026: «Эта ссылка не найдена…», «Загрузка…», «Открыть Мультичат», «Только просмотр»,
// «агент не ответил» показывались по-русски на английской странице.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: "en", t: (k: string) => k }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ token: "tok-1" }) }));

import SharedConversationPage from "../shared/[token]/page";

vi.setConfig({ testTimeout: 20_000 });

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("публичная беседа на /en", () => {
  test("отозванная ссылка и сама беседа — без кириллицы", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({}, 404)));
    render(<SharedConversationPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    expect(document.body.textContent).toContain("Link unavailable");
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => json({ error: "boom" }, 500)));
    render(<SharedConversationPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    render(<SharedConversationPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    expect(document.body.textContent).toContain("Could not load");
    cleanup();

    vi.stubGlobal("fetch", vi.fn(() => json({
      conversation: { id: "c1", title: "Pricing", createdAt: "2026-10-30T09:00:00.000Z" },
      truncated: true,
      totalTurns: 300,
      turns: [
        { role: "user", content: "How much?", createdAt: "2026-10-30T09:00:00.000Z" },
        { role: "assistant", content: "About 40.", conversationId: "c1:analyst" },
        { role: "system", content: "failed", conversationId: "c1:skeptic" },
      ],
    })));
    render(<SharedConversationPage />);
    await waitFor(() => expect(document.body.textContent).toContain("View only"));
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    expect(document.body.textContent).toContain("agent did not answer");
    expect(document.body.textContent).toContain("Showing the last part of the conversation");
  });
});
