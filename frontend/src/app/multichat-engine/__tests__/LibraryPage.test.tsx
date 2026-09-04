import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

import MultichatLibraryPage from "../library/page";
import { setAuthToken, clearAuthToken } from "@/lib/auth";

// Библиотека беседы. Главная проверка — та, которую невозможно сделать типами:
// страница читала токен по имени `aevion_token`, а вход кладёт его в
// `aevion_auth_token_v1`. Ключ не писала ни одна строка фронтенда, поэтому
// ВОШЕДШИЙ человек всегда видел «Войдите, чтобы видеть свои беседы».
//
// Токен кладём тем же setAuthToken, которым его кладёт продукт: свой ключ в
// localStorage — это состояние, которого приложение не создаёт, и тест на нём
// зеленел бы мимо настоящего контракта.
vi.setConfig({ testTimeout: 20_000 });

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  cleanup();
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("Библиотека мультичата", () => {
  test("вошедший видит свои беседы, а не приглашение войти", async () => {
    setAuthToken("jwt-test");
    const fetchMock = vi.fn(() =>
      json({
        items: [
          {
            id: "c1",
            title: "Цена тарифа medium",
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-11T10:00:00.000Z",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MultichatLibraryPage />);

    expect(await screen.findByText("Цена тарифа medium")).toBeTruthy();
    expect(screen.queryByText(/Войдите, чтобы увидеть/i)).toBeNull();

    // И запрос ушёл ПОДПИСАННЫМ — иначе сервер отдал бы чужой/пустой список.
    // Через unknown: у мока аргументы не типизированы, и прямое приведение
    // пустого кортежа к паре TypeScript справедливо запрещает.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-test");
  });

  test("без входа приглашение остаётся", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ items: [] })));
    render(<MultichatLibraryPage />);
    expect(await screen.findByText(/Войдите, чтобы увидеть свои беседы/i)).toBeTruthy();
  });

  test("сбой сети не выглядит как пустая библиотека", async () => {
    setAuthToken("jwt-test");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

    render(<MultichatLibraryPage />);

    expect(await screen.findByText(/Не удалось получить список/i)).toBeTruthy();
    // Именно это и было: уверенная неправда вместо сообщения о сбое.
    expect(screen.queryByText(/У вас пока нет беседы/i)).toBeNull();
  });

  test("отказ сервера объяснён по-русски, а не кодом", async () => {
    setAuthToken("jwt-test");
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "Too many requests" }, 429)));

    render(<MultichatLibraryPage />);

    expect(await screen.findByText(/личный счёт/i)).toBeTruthy();
  });

  test("если ссылку не удалось скопировать, её показывают, а не теряют", async () => {
    setAuthToken("jwt-test");
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(() => {
      call++;
      if (call === 1) {
        return json({
          items: [
            { id: "c1", title: "Беседа", createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" },
          ],
        });
      }
      return json({ shareUrl: "/multichat-engine/shared/tok-abc", shareToken: "tok-abc" });
    }));
    // Буфер обмена запрещён — типичный случай без разрешения.
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    // Страница сообщает через alert — перехватываем его, а не ищем текст в DOM.
    const said: string[] = [];
    vi.stubGlobal("alert", (m: string) => said.push(String(m)));

    render(<MultichatLibraryPage />);
    const btn = await screen.findByRole("button", { name: /поделиться/i });
    btn.click();

    // Адрес обязан быть В САМОМ сообщении: сказать «скопировано», когда копирование
    // не удалось, значит потерять ссылку молча.
    await waitFor(() => expect(said.length).toBeGreaterThan(0));
    expect(said.join("\n")).toMatch(/вручную/i);
    expect(said.join("\n")).toContain("multichat-engine/shared/tok-abc");
  });
});
