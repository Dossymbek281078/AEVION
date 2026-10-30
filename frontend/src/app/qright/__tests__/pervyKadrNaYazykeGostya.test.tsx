import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ToastProvider } from "@/components/ToastProvider";
import { ServerLangProvider } from "@/lib/serverLangContext";

/**
 * 🔴 ПЕРВЫЙ КАДР /qright — НА ЯЗЫКЕ ГОСТЯ, ДЛЯ РУССКОГО — РУССКИЙ СРАЗУ.
 *
 * Факт [Точно — сырой HTML прода 043aa4cc7, Accept-Language ru, без JS]: /qright
 * отдавал первым кадром «Protect Your Work». Причина: страница брала язык у
 * I18nProvider, который до langReady держит "en" (так требует гидрация).
 * Починка (решение Оркестратора 30.10.2026): qright/layout.tsx на сервере
 * выбирает язык (serverLang: кука → Accept-Language → ru) и кладёт его в
 * ServerLangProvider; страница берёт его, пока провайдер язык не определил;
 * словарь qrightI18n.ts синхронный — SSR, первый кадр и гидрация совпадают.
 */

vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AskAi", () => ({ default: () => null }));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/components/ConstitutionEmbed", () => ({ ConstitutionEmbed: () => null }));
vi.mock("@/components/PageTracking", () => ({ PageTracking: () => null }));

// eslint-disable-next-line import/first
import QRightPage from "../page";

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("макет /qright решает язык на сервере", () => {
  it("🔴 layout.tsx зовёт serverLang с умолчанием ru, рисуется на каждый запрос и отдаёт язык странице", () => {
    const макет = readFileSync(join(process.cwd(), "src/app/qright/layout.tsx"), "utf8");
    expect(макет).toContain('await serverLang("ru")');
    expect(макет).toContain("<ServerLangProvider lang={lang}>{children}</ServerLangProvider>");
    expect(макет, "маршрут должен рисоваться на каждый запрос, иначе кука не читается").toContain('export const dynamic = "force-dynamic"');
  });

  it("🔴 страница берёт язык кадра у сервера, а не `?? \"en\"` и не у useI18n()", () => {
    const страница = readFileSync(join(process.cwd(), "src/app/qright/page.tsx"), "utf8");
    expect(страница).not.toContain('useI18nOptional()?.lang ?? "en"');
    expect(страница).not.toContain("useI18n()");
    expect(страница).toContain("языкКадра(qrI18n, useServerLang())");
  });
});

describe("первый кадр /qright (SSR без провайдера) идёт на языке сервера", () => {
  it("🔴 сервер дал ru — русский h1 и маркер lang=ru, английского заголовка нет", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="ru">
        <ToastProvider>
          <QRightPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    expect(container.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("ru");
    expect(container.querySelector("h1")?.textContent).toBe("Защитите свою работу");
    expect(container.textContent).not.toContain("Protect Your Work");
  });

  it("сервер дал en (кука en) — английский сразу", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="en">
        <ToastProvider>
          <QRightPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Protect Your Work");
    expect(container.textContent).not.toContain("Защитите свою работу");
  });

  it("сервер дал kk — казахский h1 из словаря", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="kk">
        <ToastProvider>
          <QRightPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    const h1 = container.querySelector("h1")?.textContent ?? "";
    expect(h1).not.toBe("Protect Your Work");
    expect(h1).not.toBe("Защитите свою работу");
    expect(h1.length).toBeGreaterThan(5);
  });
});
