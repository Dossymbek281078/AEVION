import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { адресВозврата } from "@/app/auth/returnTo";

/**
 * 2.11.2026 (прод 5c84234b1, чистый браузер): на /devhub у гостя не было «Войти» с возвратом —
 * только шапка «Авторизация» → /auth без next. Теперь рядом с «Бесплатно, без регистрации…» —
 * кнопка по языку страницы; next=/devhub и метка канала ?c= едут тем же механизмом, что на /bureau.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/devhub",
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@monaco-editor/react", () => ({ default: () => null }));

// eslint-disable-next-line import/first
import DevHubPage from "../page";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* пусто */ }
  window.history.replaceState(null, "", "/");
});

function открыть(l: "ru" | "en" | "kk") {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch);
  return render(<ServerLangProvider lang={l}><DevHubPage /></ServerLangProvider>);
}

describe("/devhub: гость видит «Войти» с next и меткой", () => {
  it("ru: кнопка «Войти», next=/devhub и ?c=probe-apps и в /auth, и в возврате", async () => {
    window.history.replaceState(null, "", "/devhub?c=probe-apps");
    открыть("ru");
    const a = await waitFor(() => {
      const el = document.querySelector("[data-devhub-signin='hero']") as HTMLAnchorElement | null;
      expect(el, "кнопки «Войти» у гостя нет").toBeTruthy();
      return el!;
    });
    expect(a.textContent).toBe("Войти");
    await waitFor(() => expect(a.getAttribute("href")).toContain("probe-apps"));
    const href = a.getAttribute("href") ?? "";
    expect(href.startsWith("/auth?")).toBe(true);
    const q = href.slice(href.indexOf("?"));
    expect(new URLSearchParams(q).get("c")).toBe("probe-apps");
    expect(адресВозврата(q)).toBe("/devhub?c=probe-apps");
  });

  it("en и kk: подпись по языку страницы", async () => {
    for (const [l, текст] of [["en", "Sign in"], ["kk", "Кіру"]] as const) {
      const { unmount } = открыть(l);
      const a = await waitFor(() => {
        const el = document.querySelector("[data-devhub-signin='hero']");
        expect(el).toBeTruthy();
        return el as HTMLElement;
      });
      expect(a.textContent).toBe(текст);
      unmount();
    }
  });

  it("вошедшему кнопка не нужна", async () => {
    localStorage.setItem("aevion_auth_token_v1", "t");
    открыть("ru");
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("[data-devhub-signin='hero']")).toBeNull();
  });
});
