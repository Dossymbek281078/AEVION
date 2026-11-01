import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { I18nProvider } from "@/lib/i18n";
import { адресВозврата } from "@/app/auth/returnTo";

/**
 * 2.11.2026 (прод 9e79992aa, чистый браузер): общая шапка уже несла /auth?next=…&c=…, но на
 * /multichat-engine и /qsign единственная «Авторизация» — в полосе модулей Wave1Nav, и она вела
 * на голый /auth: вход терял страницу и метку канала.
 */
const путь = { value: "/multichat-engine" };
vi.mock("next/navigation", () => ({
  usePathname: () => путь.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line import/first
import { Wave1Nav } from "../Wave1Nav";

afterEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* пусто */ }
  window.history.replaceState(null, "", "/");
});

function ссылкиВхода(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll("a")).filter((a) => (a.getAttribute("href") ?? "").startsWith("/auth")) as HTMLAnchorElement[];
}

describe("полоса модулей: «Авторизация» с возвратом и меткой", () => {
  it("/multichat-engine?c=probe-apps → /auth?next=%2Fmultichat-engine%3Fc%3Dprobe-apps&c=probe-apps", async () => {
    путь.value = "/multichat-engine";
    window.history.replaceState(null, "", "/multichat-engine?c=probe-apps");
    render(<I18nProvider><ServerLangProvider lang="ru"><Wave1Nav /></ServerLangProvider></I18nProvider>);
    await waitFor(() => expect(ссылкиВхода()[0]?.getAttribute("href") ?? "").toContain("probe-apps"));
    for (const a of ссылкиВхода()) {
      const href = a.getAttribute("href") ?? "";
      expect(href).toBe("/auth?next=%2Fmultichat-engine%3Fc%3Dprobe-apps&c=probe-apps");
      expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/multichat-engine?c=probe-apps");
    }
  });
});
