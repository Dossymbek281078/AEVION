import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { I18nProvider } from "@/lib/i18n";

/**
 * 2.11.2026 (прод 9d402417f, чистый браузер): на /qsign шаг «✓ Авторизация» схемы IP-конвейера
 * вёл на голый /auth — вход терял страницу и метку канала. Остальные шаги — как были.
 */
const путь = { value: "/qsign" };
vi.mock("next/navigation", () => ({
  usePathname: () => путь.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line import/first
import { PipelineSteps } from "../PipelineSteps";

afterEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* пусто */ }
  window.history.replaceState(null, "", "/");
});

describe("схема IP-конвейера: шаг «Авторизация» с возвратом и меткой", () => {
  it("/qsign?c=probe-apps → /auth?next=%2Fqsign%3Fc%3Dprobe-apps&c=probe-apps, шаг QRight не тронут", async () => {
    путь.value = "/qsign";
    window.history.replaceState(null, "", "/qsign?c=probe-apps");
    render(<I18nProvider><ServerLangProvider lang="ru"><PipelineSteps current="qsign" /></ServerLangProvider></I18nProvider>);
    const ссылки = () => Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    await waitFor(() => expect(ссылки().find((h) => h.startsWith("/auth")) ?? "").toContain("probe-apps"));
    expect(ссылки().find((h) => h.startsWith("/auth"))).toBe("/auth?next=%2Fqsign%3Fc%3Dprobe-apps&c=probe-apps");
    expect(ссылки()).toContain("/qright");
  });
});
