import { describe, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Suspense } from "react";
import { I18nProvider } from "@/lib/i18n";
import { DEVHUB_DICT } from "../i18n";

/**
 * 🔴 Страница проекта /devhub/[id] на en: вкладки и пустые состояния — по-английски.
 * Замер 30.10.2026: после «Build» половина страницы русская («Генерация ИИ»,
 * «Файлы», «Файлов пока нет…», «Есть только замысел?», «Отменить последнюю правку ИИ»).
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/devhub/proba",
}));
vi.mock("@/lib/apiBase", () => ({
  apiUrl: (p: string) => p,
  fetchWithRedeployRetry: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
}));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@monaco-editor/react", () => ({ default: () => null }));
vi.mock("@/lib/i18n", async (orig) => {
  const m = await orig<typeof import("@/lib/i18n")>();
  return { ...m, useI18nOptional: () => ({ lang: "en", langReady: true, t: (k: string) => k, setLang: () => {} }) };
});

import DevHubProjectPage from "../[id]/page";

const КЛЮЧИ = [
  "proj.tab.chat", "proj.tab.visual", "proj.tab.agent", "proj.tab.templates",
  "proj.tab.media", "proj.tab.env", "proj.tab.deployments", "proj.tab.settings",
  "proj.files", "proj.noFiles1", "proj.noFiles2", "proj.planner", "proj.undoAi", "proj.tplFailed", "proj.tplLoading",
];

describe("страница проекта на языке читателя", () => {
  test("сторож: ключи есть в en, ru и kk, и en/kk не пустые и не равны русскому", () => {
    for (const k of КЛЮЧИ) {
      for (const l of ["en", "ru", "kk"]) {
        expect((DEVHUB_DICT[l] as Record<string, string>)[k], `${l}:${k}`).toBeTruthy();
      }
      expect((DEVHUB_DICT.en as Record<string, string>)[k], k).not.toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  test("🔴 en: вкладки и «Файлы» без кириллицы, русских подписей нет", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      const s = String(u);
      if (s.includes("/files")) return new Response(JSON.stringify({ files: [] }), { status: 200 });
      if (s.includes("/capabilities")) return new Response(JSON.stringify({ capabilities: [] }), { status: 200 });
      return new Response(JSON.stringify({ project: {
        id: "proba", name: "Proba", stack: "static", status: "draft",
        deployUrl: null, files: [], envVars: {}, collaborators: [],
      } }), { status: 200 });
    }));
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <I18nProvider>
          <Suspense fallback={null}>
            <DevHubProjectPage params={Promise.resolve({ id: "proba" })} />
          </Suspense>
        </I18nProvider>,
      ).container;
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const текст = container.textContent ?? "";
    expect(текст.length).toBeGreaterThan(20);
    for (const ru of ["Генерация ИИ", "Правка на экране", "Агент", "Шаблоны", "Файлы", "Файлов пока нет", "Есть только замысел"]) {
      expect(текст, ru).not.toContain(ru);
    }
    expect(текст).toContain("AI generation");
    expect(текст).toContain("Files");
    expect(текст).toContain("No files yet.");
  });
});
