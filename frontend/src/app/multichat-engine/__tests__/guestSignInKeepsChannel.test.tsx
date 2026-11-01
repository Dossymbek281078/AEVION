// 2.11.2026 (прод 5c84234b1, чистый браузер): рядом с «Дальше — вход по почте» на /multichat-engine
// не было кнопки «Войти», а ссылка стены вела на /auth?next=/multichat-engine без метки канала.
// Теперь обе — через useСсылкаВхода (как /bureau): next и сам /auth несут ?c=.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { адресВозврата as adressVozvrata } from "@/app/auth/returnTo";

let язык = "ru";
vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getAuthHeaders: () => ({}) }));
vi.mock("@/lib/i18n", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useI18nOptional: () => ({ lang: язык }) };
});

import { CouncilConsole } from "../CouncilConsole";

function сервер(осталось: number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("multichat-guest/allowance")) {
      return { ok: true, json: async () => ({ лимит: 2, использовано: 2 - осталось, осталось }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  sessionStorage.clear();
  язык = "ru";
});

describe("гость на /multichat-engine: «Войти» с next и меткой", () => {
  test("норма есть — рядом с текстом кнопка «Войти», ведёт на /auth и возвращает с ?c=probe-apps", async () => {
    window.history.replaceState(null, "", "/multichat-engine?c=probe-apps");
    vi.stubGlobal("fetch", сервер(2));
    render(<CouncilConsole />);
    await waitFor(() => expect(screen.getByText(/осталось 2/i)).toBeTruthy());
    const a = (await waitFor(() => {
      const el = document.querySelector("[data-mc-signin='guest-left']");
      expect(el, "кнопки «Войти» рядом с остатком нет").toBeTruthy();
      return el as HTMLAnchorElement;
    }));
    expect(a.textContent).toBe("Войти");
    await waitFor(() => expect(a.getAttribute("href")).toContain("probe-apps"));
    const href = a.getAttribute("href") ?? "";
    expect(href.startsWith("/auth?")).toBe(true);
    expect(new URLSearchParams(href.slice(href.indexOf("?"))).get("c")).toBe("probe-apps");
    expect(adressVozvrata(href.slice(href.indexOf("?")))).toBe("/multichat-engine?c=probe-apps");
  });

  test("подпись кнопки по языку страницы: en и kk", async () => {
    for (const [l, текст] of [["en", "Sign in"], ["kk", "Кіру"]] as const) {
      язык = l;
      vi.stubGlobal("fetch", сервер(2));
      const { unmount } = render(<CouncilConsole />);
      const el = await waitFor(() => {
        const e = document.querySelector("[data-mc-signin='guest-left']");
        expect(e).toBeTruthy();
        return e as HTMLElement;
      });
      expect(el.textContent).toBe(текст);
      unmount();
    }
  });

  test("стена: «войдите по почте» тоже несёт метку", async () => {
    window.history.replaceState(null, "", "/multichat-engine?c=probe-apps");
    vi.stubGlobal("fetch", сервер(0));
    render(<CouncilConsole />);
    const a = await screen.findByText(/войдите по почте/i);
    await waitFor(() => expect(a.getAttribute("href")).toContain("probe-apps"));
  });
});
