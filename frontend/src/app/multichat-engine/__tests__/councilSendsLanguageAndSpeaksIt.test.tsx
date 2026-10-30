// Консилиум на /en: страница передаёт серверу язык, а строки под отчётом не остаются русскими.
// Замер 30.10.2026 (прод, ?c=probe-multichat): в английском отчёте стояли «схожесть 0.029», «Чек · вызовов 3,
// ответили 3», «подписан (ed25519, …)» и русские тексты проверок, которые строит сервер (теперь — по полю lang).
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getAuthHeaders: () => ({}) }));
vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: "en", t: (k: string) => k }),
}));

import { CouncilConsole } from "../CouncilConsole";
import { tm } from "../mcText";

afterEach(() => vi.unstubAllGlobals());

describe("консилиум на /en", () => {
  test("запрос на dispatch несёт lang=en — иначе сервер отвечает по-русски", async () => {
    const вызовы: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      вызовы.push({ url, body: String(init?.body ?? "") });
      if (url.includes("multichat-guest/allowance")) return { ok: true, json: async () => ({ лимит: 2, использовано: 0, осталось: 2 }) } as Response;
      if (url.endsWith("/conversations")) return { ok: true, status: 201, json: async () => ({ id: "c1" }) } as Response;
      return { ok: true, status: 200, json: async () => ({ results: [], dissent: null, receipt: null }) } as Response;
    }));
    render(<CouncilConsole />);
    const поле = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(поле, { target: { value: "Should we launch a paid tier first?" } });
    const кнопка = await screen.findByRole("button", { name: /Ask the council/i });
    await waitFor(() => expect((кнопка as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(кнопка);
    await waitFor(() => expect(вызовы.some((в) => в.url.includes("/dispatch"))).toBe(true));
    const dispatch = вызовы.find((в) => в.url.includes("/dispatch"))!;
    expect(JSON.parse(dispatch.body).lang, "сервер не знает язык страницы").toBe("en");
  });

  test("подписи под отчётом переведены на en и kk, а русский остаётся исходником", () => {
    for (const ключ of ["схожесть", "Чек · вызовов", "ответили", "не ответили", "подписан"]) {
      expect(tm("en", ключ), `${ключ} на en`).not.toMatch(/[А-Яа-яЁё]/);
      expect(tm("kk", ключ), `${ключ} на kk`).not.toBe(ключ);
      expect(tm("ru", ключ)).toBe(ключ);
    }
  });
});
