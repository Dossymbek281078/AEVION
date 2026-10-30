import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 ПЕРВЫЙ КАДР /devhub — НА ЯЗЫКЕ ГОСТЯ, ДЛЯ РУССКОГО — РУССКИЙ СРАЗУ.
 *
 * Замер Науки 30.10.2026: curl прода с Accept-Language: ru отдавал английский h1
 * («A site from a description…»), HTML побайтно одинаков для ru и en. Причина —
 * I18nProvider до langReady держит "en". Починка: devhub/layout.tsx выбирает язык
 * на сервере (serverLang: кука → Accept-Language → ru), кладёт его в
 * ServerLangProvider; страница и useDevhubT берут его, пока язык не определён.
 */

const lang = vi.hoisted(() => ({ value: "ru" as "ru" | "en" | "kk" }));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/devhub",
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@monaco-editor/react", () => ({ default: () => null }));

// eslint-disable-next-line import/first
import DevHubLayout from "../layout";
// eslint-disable-next-line import/first
import DevHubPage from "../page";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

async function кадр(l: "ru" | "en" | "kk") {
  lang.value = l;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch);
  const дерево = await DevHubLayout({ children: <DevHubPage /> });
  // Серверная отрисовка под настоящим I18nProvider: эффекты не идут, язык "en", langReady=false — ровно первый кадр.
  const div = document.createElement("div");
  div.innerHTML = renderToString(<I18nProvider>{дерево}</I18nProvider>);
  return { container: div };
}

describe("макет /devhub решает язык на сервере (сторож)", () => {
  it("🔴 layout.tsx зовёт serverLang, оборачивает в ServerLangProvider и рисуется на каждый запрос", () => {
    const макет = readFileSync(join(process.cwd(), "src/app/devhub/layout.tsx"), "utf8");
    expect(макет).toContain('await serverLang("ru")');
    expect(макет).toContain("<ServerLangProvider lang={lang}>");
    expect(макет).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("первый кадр /devhub идёт на языке сервера", () => {
  it("🔴 сервер дал ru, I18nProvider ещё на en — русский h1 и маркер lang=ru", async () => {
    const { container } = await кадр("ru");
    const маркер = container.querySelector("[data-server-lang]");
    expect(маркер?.getAttribute("data-server-lang")).toBe("ru");
    expect(маркер?.getAttribute("lang")).toBe("ru");
    const h1 = container.querySelector("h1")?.textContent ?? "";
    expect(h1).toMatch(/[А-Яа-яЁё]/);
    expect(h1).not.toContain("A site from a description");
  });

  it("сервер дал en — английский h1", async () => {
    const { container } = await кадр("en");
    expect(container.querySelector("[data-server-lang]")?.getAttribute("data-server-lang")).toBe("en");
    const h1 = container.querySelector("h1")?.textContent ?? "";
    expect(h1).not.toMatch(/[А-Яа-яЁё]/);
    expect(h1.length).toBeGreaterThan(5);
  });
});
