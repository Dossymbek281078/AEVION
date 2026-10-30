import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ToastProvider } from "@/components/ToastProvider";
import { ServerLangProvider, языкКадра } from "@/lib/serverLangContext";

/**
 * 🔴 ПЕРВЫЙ КАДР /bureau — НА ЯЗЫКЕ ГОСТЯ, ДЛЯ РУССКОГО — РУССКИЙ СРАЗУ.
 *
 * Решение Оркестратора 30.10.2026: бюро — денежная страница основного, русского
 * канала. Страница брала `useI18nOptional()?.lang ?? "en"`, а I18nProvider до
 * langReady держит "en" — первый кадр шёл по-английски и перерисовывался.
 * Починка: bureau/layout.tsx на сервере выбирает язык (serverLang: кука →
 * Accept-Language → ru) и кладёт его в ServerLangProvider; страница берёт его,
 * пока провайдер не определил язык. Страница рисуется на клиенте (Suspense), в
 * сыром HTML h1 нет — там виден маркер data-server-lang на обёртке провайдера.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

// eslint-disable-next-line import/first
import BureauPage from "../page";

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

describe("макет /bureau решает язык на сервере", () => {
  it("🔴 layout.tsx зовёт serverLang с умолчанием ru, рисуется на каждый запрос и отдаёт язык странице", () => {
    const макет = readFileSync(join(process.cwd(), "src/app/bureau/layout.tsx"), "utf8");
    expect(макет).toContain('await serverLang("ru")');
    expect(макет).toContain("<ServerLangProvider lang={lang}>{children}</ServerLangProvider>");
    expect(макет, "маршрут должен рисоваться на каждый запрос, иначе кука не читается").toContain('export const dynamic = "force-dynamic"');
  });

  it("🔴 страница берёт язык кадра у сервера, а не `?? \"en\"`", () => {
    const страница = readFileSync(join(process.cwd(), "src/app/bureau/page.tsx"), "utf8");
    expect(страница).not.toContain('buI18n?.lang ?? "en"');
    expect(страница).toContain("языкКадра(buI18n, useServerLang())");
  });

  it("языкКадра: провайдер не готов → серверный; готов → провайдера; без макета — en", () => {
    expect(языкКадра({ lang: "en", langReady: false }, "ru")).toBe("ru");
    expect(языкКадра(null, "kk")).toBe("kk");
    expect(языкКадра({ lang: "en", langReady: true }, "ru")).toBe("en");
    expect(языкКадра(null, null)).toBe("en");
    expect(языкКадра({ lang: "en", langReady: false }, null)).toBe("en");
  });
});

describe("первый клиентский кадр /bureau идёт на языке сервера", () => {
  it("🔴 сервер дал ru, провайдера нет — русский h1, CTA и маркер lang=ru", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="ru">
        <ToastProvider>
          <BureauPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    const маркер = container.querySelector("[data-server-lang]");
    expect(маркер?.getAttribute("data-server-lang")).toBe("ru");
    expect(маркер?.getAttribute("lang")).toBe("ru");
    expect(container.querySelector("h1")?.textContent).toBe("Цифровое бюро авторства AEVION");
    expect(container.textContent).toContain("Защитить работу");
    expect(container.textContent).not.toContain("AEVION Digital IP Bureau");
    expect(container.textContent).not.toContain("Protect Your Work");
  });

  it("сервер дал en (кука en) — английский сразу", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="en">
        <ToastProvider>
          <BureauPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    expect(container.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
    expect(container.querySelector("h1")?.textContent).toBe("AEVION Digital IP Bureau");
    expect(container.textContent).not.toContain("Цифровое бюро авторства");
  });

  it("сервер дал kk — казахский h1", () => {
    stubFetch();
    const { container } = render(
      <ServerLangProvider lang="kk">
        <ToastProvider>
          <BureauPage />
        </ToastProvider>
      </ServerLangProvider>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("AEVION цифрлық авторлық бюросы");
  });
});
