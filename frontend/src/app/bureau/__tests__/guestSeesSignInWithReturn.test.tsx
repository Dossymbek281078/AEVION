/**
 * Гость на /bureau видит на месте «Мои сертификаты» приглашение войти — со ссылкой,
 * которая ВЕРНЁТ его в бюро (`/auth?next=/bureau`, returnTo.ts читает next).
 *
 * ПОВОД (прод 30.10.2026, гость 390 px): блок «Мои сертификаты» рисовался только
 * вошедшему, гостю — пустота; своей кнопки «Войти» в main не было (только «Auth» в
 * навигации), и регистрация с голого /auth оставляла человека на /auth — в page.tsx
 * не было ни одной ссылки с `next=/bureau`.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { tBureau } from "../bureauText";

let params = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "../page";

const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

beforeEach(() => {
  params = new URLSearchParams("");
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      // Кабинет вошедшего — пустой, но полный по форме: verifications читает страница сразу.
      if (String(url).includes("/api/bureau/dashboard")) {
        return { ok: true, status: 200, json: async () => ({ certificates: [], verifications: [], trustEdges: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ certificates: [] }) };
    }) as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("гость на /bureau", () => {
  test("видит ссылку входа с next=/bureau на месте «Мои сертификаты»", async () => {
    renderPage();
    const блок = await waitFor(() => {
      const el = document.querySelector("[data-bureau-guest-signin]");
      expect(el, "блок гостя не отрисован").toBeTruthy();
      return el as HTMLElement;
    });
    expect(блок.textContent).toContain("Sign in to see your certificates");
    const ссылка = блок.querySelector("a") as HTMLAnchorElement | null;
    expect(ссылка, "ссылки входа нет").toBeTruthy();
    const href = ссылка!.getAttribute("href") ?? "";
    expect(href.startsWith("/auth?")).toBe(true);
    expect(new URLSearchParams(href.slice(href.indexOf("?"))).get("next")).toBe("/bureau");
  });

  test("вошедшему блок гостя не рисуется", async () => {
    localStorage.setItem("aevion_auth_token_v1", "t"); // TOKEN_KEY страницы бюро
    renderPage();
    // Дать эффектам отработать: вошедший помечается после чтения хранилища.
    await waitFor(() => expect(screen.queryByText("Sign in to see your certificates")).toBeNull());
    expect(document.querySelector("[data-bureau-guest-signin]")).toBeNull();
  });

  test("тексты блока переведены на ru и kk", () => {
    for (const en of ["Sign in to see your certificates", "Works registered with your email will appear here after you sign in.", "Sign in or create an account →"]) {
      expect(tBureau("en", en)).toBe(en);
      expect(tBureau("ru", en), en).toMatch(/[А-Яа-яЁё]/);
      expect(tBureau("kk", en), en).not.toBe(en);
      expect(tBureau("kk", en), en).not.toBe(tBureau("ru", en));
    }
    expect(tBureau("ru", "Sign in to see your certificates")).toBe("Войдите, чтобы видеть свои сертификаты");
  });
});
