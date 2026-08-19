/**
 * Ключ входа: страница видит сессию вошедшего человека.
 *
 * До 12.08.2026 этот компонент — и ещё 67 файлов — читали токен литералом
 * `localStorage.getItem("aevion_token")`. Под этим именем JWT не пишет НИКТО:
 * форма входа кладёт его под `aevion_auth_token_v1`. Отказа при этом не было,
 * и потому дефект прожил месяцы: компонент просто молча возвращал null, а
 * страницы уходили в бэкенд без заголовка Authorization и получали 401.
 *
 * Тест держит именно путь человека: «вошёл через форму → страница увидела»,
 * а не подстановку ключа руками. Поэтому токен здесь кладётся тем же
 * `setAuthToken()`, которым его кладёт `/auth`, и мёртвый ключ проверяется
 * отдельным случаем — он не должен пускать никого.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ZTideRankPill from "../fintech/ZTideRankPill";
import { setAuthToken, clearAuthToken } from "@/lib/auth";

type FetchCall = { url: string; headers: Record<string, string> };

function stubFetch(calls: FetchCall[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return {
      ok: true,
      json: async () => ({ score: 128, rank: { id: "wave", label: "Wave" } }),
    } as Response;
  });
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom без хранилища — тогда чистить нечего */
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  clearAuthToken();
});

describe("ключ входа — ZTideRankPill", () => {
  it("после входа шлёт Bearer и показывает ранг", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubFetch(calls));
    // Ровно то, что делает форма входа.
    setAuthToken("jwt-from-login");

    render(<ZTideRankPill />);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toContain("/api/ztide/me");
    expect(calls[0].headers.Authorization).toBe("Bearer jwt-from-login");
    expect(await screen.findByText(/Wave/)).toBeInTheDocument();
  });

  it("без входа не ходит в сеть вовсе", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubFetch(calls));

    const { container } = render(<ZTideRankPill />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(calls).toHaveLength(0);
  });

  it("мёртвый ключ aevion_token сессией не считается", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubFetch(calls));
    // Именно этот ключ компонент читал раньше. Его не пишет ни форма входа,
    // ни что-либо ещё во фронтенде, поэтому значение под ним — мусор из
    // старых сборок, а не сессия. Пускать по нему нельзя.
    localStorage.setItem("aevion_token", "stale-garbage");

    const { container } = render(<ZTideRankPill />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(calls).toHaveLength(0);
  });
});
