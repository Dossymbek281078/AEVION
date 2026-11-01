import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { I18nProvider } from "@/lib/i18n";
import { адресВозврата } from "@/app/auth/returnTo";

/**
 * 2.11.2026 (прод ad2f92fa1): ссылка «Авторизация» в общей шапке вела на голый /auth на всех страницах —
 * возврат и метка канала терялись. Теперь /auth?next=<путь с query>&c=<метка>, как у кнопок «Войти».
 * На самой /auth next не ставится (шапка не зацикливается).
 */
const путь = { value: "/bureau" };
vi.mock("next/navigation", () => ({
  usePathname: () => путь.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line import/first
import { SiteHeader } from "../SiteHeader";

(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

afterEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* пусто */ }
  window.history.replaceState(null, "", "/");
});

function ссылки(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll("a")).filter((a) => (a.getAttribute("href") ?? "").startsWith("/auth")) as HTMLAnchorElement[];
}

describe("шапка: «Авторизация» с возвратом и меткой", () => {
  it("/bureau?c=probe-apps: /auth?next=%2Fbureau%3Fc%3Dprobe-apps&c=probe-apps (обе разметки шапки)", async () => {
    путь.value = "/bureau";
    window.history.replaceState(null, "", "/bureau?c=probe-apps");
    render(<I18nProvider><ServerLangProvider lang="ru"><SiteHeader /></ServerLangProvider></I18nProvider>);
    await waitFor(() => expect(ссылки().length).toBeGreaterThan(0));
    await waitFor(() => expect(ссылки()[0].getAttribute("href")).toContain("probe-apps"));
    for (const a of ссылки()) {
      const href = a.getAttribute("href") ?? "";
      expect(href).toBe("/auth?next=%2Fbureau%3Fc%3Dprobe-apps&c=probe-apps");
      expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/bureau?c=probe-apps");
    }
  });

  it("путь с query без метки: next несёт query целиком", async () => {
    путь.value = "/pricing";
    window.history.replaceState(null, "", "/pricing?plan=pro");
    render(<I18nProvider><ServerLangProvider lang="ru"><SiteHeader /></ServerLangProvider></I18nProvider>);
    await waitFor(() => expect(ссылки()[0].getAttribute("href")).toContain("plan"));
    expect(ссылки()[0].getAttribute("href")).toBe("/auth?next=%2Fpricing%3Fplan%3Dpro");
  });

  it("на самой /auth next не ставится, метка остаётся", async () => {
    путь.value = "/auth";
    window.history.replaceState(null, "", "/auth?next=%2Fbureau&c=probe-apps");
    render(<I18nProvider><ServerLangProvider lang="ru"><SiteHeader /></ServerLangProvider></I18nProvider>);
    await waitFor(() => expect(ссылки()[0].getAttribute("href")).toContain("probe-apps"));
    const href = ссылки()[0].getAttribute("href") ?? "";
    expect(href).not.toContain("next=");
    expect(href.startsWith("/auth")).toBe(true);
  });
});
