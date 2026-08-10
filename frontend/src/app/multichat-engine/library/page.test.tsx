// Библиотека бесед: узнаёт ли страница вошедшего человека.
//
// Зачем тест, а не проверка глазами. Страница читала ключ входа литералом
// "aevion_token" — ключ, который в коде фронтенда НИКТО не записывает (вход
// кладёт токен под "aevion_auth_token_v1"). Такая страница показывает
// «Войдите» человеку, который вошёл, и отказа при этом нет.
//
// Проверить это в браузере в нашем worktree невозможно: node_modules
// подключены junction-ом, из-за чего dev-сервер не оживляет клиент (Turbopack
// симлинк отвергает, webpack-режим не поднимает HMR и гидрации нет). Час на
// этом потерян, и наблюдение «страница показывает Войдите» оказалось
// свойством стенда, а не кода. Поэтому проверка живёт здесь: она не зависит
// ни от сервера, ни от браузера.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import MultichatLibraryPage from "./page";

const TOKEN = "test.jwt.token";
const CANONICAL_KEY = "aevion_auth_token_v1";
const DEAD_KEY = "aevion_token";

function mockFetchOk() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ items: [{ id: "conv_1", title: "Первая беседа", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Библиотека бесед и ключ входа", () => {
  test("с каноническим ключом страница узнаёт вошедшего и запрашивает беседы", async () => {
    localStorage.setItem(CANONICAL_KEY, TOKEN);
    const fetchMock = mockFetchOk();

    render(<MultichatLibraryPage />);

    // Главное: список запрошен, причём с Bearer — значит сессия распознана.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);

    // И приглашения войти на экране быть не должно.
    await waitFor(() =>
      expect(screen.queryByText(/Войдите, чтобы увидеть свои беседы/)).toBeNull(),
    );
  });

  test("мёртвый ключ сессией не считается — иначе дефект вернётся незамеченным", async () => {
    // Именно так страница и была сломана: токен в хранилище есть, но под
    // ключом, который никто не пишет. Тест фиксирует, что это состояние
    // трактуется как «не вошёл», а не как рабочая сессия.
    localStorage.setItem(DEAD_KEY, TOKEN);
    const fetchMock = mockFetchOk();

    render(<MultichatLibraryPage />);

    expect(await screen.findByText(/Войдите, чтобы увидеть свои беседы/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("без токена — приглашение войти и ни одного запроса", async () => {
    const fetchMock = mockFetchOk();

    render(<MultichatLibraryPage />);

    expect(await screen.findByText(/Войдите, чтобы увидеть свои беседы/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
