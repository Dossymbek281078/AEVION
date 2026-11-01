import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { ToastProvider } from "@/components/ToastProvider";
import { адресВозврата } from "@/app/auth/returnTo";

/**
 * 2.11.2026: кнопки «Войти» на /qsign шли на /auth?next=/qsign и теряли ?c=.
 * Теперь — тот же механизм, что на /bureau и /devhub.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/qsign",
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));

// eslint-disable-next-line import/first
import QSignPage from "../page";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* пусто */ }
  window.history.replaceState(null, "", "/");
});

describe("/qsign: «Войти» гостя несёт next и метку", () => {
  it("?c=probe-apps есть и в /auth, и в возврате; без метки — прежний next=/qsign", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, service: "qsign", activeKeys: { hmac: "v1", ed25519: "v1" }, signatures: { total: 0 }, items: [] }) })) as unknown as typeof fetch);
    window.history.replaceState(null, "", "/qsign?c=probe-apps");
    render(<ToastProvider><ServerLangProvider lang="ru"><QSignPage /></ServerLangProvider></ToastProvider>);
    const a = await waitFor(() => {
      const el = document.querySelector("[data-qsign-cta='guest']") as HTMLAnchorElement | null;
      expect(el, "кнопки гостя нет").toBeTruthy();
      return el!;
    });
    await waitFor(() => expect(a.getAttribute("href")).toContain("probe-apps"));
    const href = a.getAttribute("href") ?? "";
    const q = href.slice(href.indexOf("?"));
    expect(href.startsWith("/auth?")).toBe(true);
    expect(new URLSearchParams(q).get("c")).toBe("probe-apps");
    expect(адресВозврата(q)).toBe("/qsign?c=probe-apps");
  });
});
