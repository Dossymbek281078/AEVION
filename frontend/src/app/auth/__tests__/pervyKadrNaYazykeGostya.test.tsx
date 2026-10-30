import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

/**
 * 🔴 ПЕРВЫЙ КАДР /auth — НА ЯЗЫКЕ ГОСТЯ, ДЛЯ РУССКОГО — РУССКИЙ СРАЗУ.
 *
 * Решение Оркестратора 30.10.2026: ru — основной канал, вход — денежный экран;
 * первый кадр по-английски с перерисовкой в русский неприемлем. Причина была
 * механической: I18nProvider стартует с "en" (так требует гидрация), русский
 * словарь догружается куском — словарь через t() давал английский SSR-HTML.
 *
 * Починка: auth/layout.tsx на сервере выбирает язык (кука → Accept-Language →
 * ru) и отдаёт странице строки auth.* этого языка; до langReady провайдера
 * страница рисует их. Сторож держит обе половины: выбор языка сервером и то,
 * что страница рисует серверные строки ДО готовности провайдера — ровно так
 * выглядит SSR и первый кадр.
 */

vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/PipelineSteps", () => ({ PipelineSteps: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import AuthPage from "../page";
// eslint-disable-next-line import/first
import { AuthServerTextProvider } from "../authServerText";
// eslint-disable-next-line import/first
import { строкиAuth } from "../authServerStrings";

function stubFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ providers: [] }),
  } as unknown as Response);
}

function withSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: new URL("https://aevion.app/auth" + search) as unknown as Location,
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("сервер отдаёт странице строки первого кадра", () => {
  // Выбор языка (путь → кука → Accept-Language → ru) — lib/serverLang.ts, его
  // приёмка в lib/__tests__/serverLang.test.ts. Макет auth/layout.tsx зовёт
  // serverLang("ru") — закрепляем, что умолчание входа именно ru.
  it("🔴 макет /auth берёт язык у serverLang с умолчанием ru", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const макет = readFileSync(join(process.cwd(), "src/app/auth/layout.tsx"), "utf8");
    expect(макет).toContain('await serverLang("ru")');
    expect(макет).toContain("<AuthServerTextProvider lang={lang} strings={строкиAuth(lang)}>");
    expect(макет, "маршрут должен рисоваться на каждый запрос, иначе кука не читается").toContain('export const dynamic = "force-dynamic"');
  });

  it("строки первого кадра — все ключи auth.* словаря и ничего лишнего", () => {
    const ключи = Object.keys(en).filter((k) => k.startsWith("auth."));
    expect(ключи.length, "контроль прибора: ключей auth.* в en").toBeGreaterThanOrEqual(80);
    for (const lang of ["ru", "en", "kk"] as const) {
      const строки = строкиAuth(lang);
      expect(Object.keys(строки).sort()).toEqual(ключи.slice().sort());
      const словарь = { ru, en, kk }[lang] as Record<string, string>;
      for (const k of ключи) expect(строки[k], `${lang}: ${k}`).toBe(словарь[k]);
    }
    expect(строкиAuth("ru")["auth.hero.title"]).toBe("Вход в AEVION");
    expect(строкиAuth("kk")["auth.hero.title"]).toBe("AEVION-ға кіру");
  });
});

describe("страница рисует серверные строки до готовности провайдера", () => {
  it("🔴 SSR/первый кадр для ru: без провайдера — русский h1, lang=ru, ни одного английского заголовка", () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("");
    render(
      <AuthServerTextProvider lang="ru" strings={строкиAuth("ru")}>
        <ToastProvider>
          <AuthPage />
        </ToastProvider>
      </AuthServerTextProvider>,
    );
    const main = document.querySelector("main");
    expect(main?.getAttribute("lang")).toBe("ru");
    const текст = main?.textContent ?? "";
    expect(текст).toContain("Вход в AEVION");
    expect(текст).toContain("Что открывает аккаунт AEVION");
    expect(текст).toContain("Создать аккаунт");
    expect(текст).not.toContain("Sign in to AEVION");
    expect(текст).not.toContain("Create account");
  });

  it("первый кадр для en (кука en): английский сразу", () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("");
    render(
      <AuthServerTextProvider lang="en" strings={строкиAuth("en")}>
        <ToastProvider>
          <AuthPage />
        </ToastProvider>
      </AuthServerTextProvider>,
    );
    const main = document.querySelector("main");
    expect(main?.getAttribute("lang")).toBe("en");
    expect(main?.textContent ?? "").toContain("Sign in to AEVION");
    expect(main?.textContent ?? "").not.toContain("Вход в AEVION");
  });

  it("первый кадр для kk: казахский h1 из словаря", () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("");
    render(
      <AuthServerTextProvider lang="kk" strings={строкиAuth("kk")}>
        <ToastProvider>
          <AuthPage />
        </ToastProvider>
      </AuthServerTextProvider>,
    );
    expect(document.querySelector("main")?.getAttribute("lang")).toBe("kk");
    expect(document.querySelector("main")?.textContent ?? "").toContain("AEVION-ға кіру");
  });

  it("с провайдером: сервер дал ru, гость явно просит ?lang=en — после гидрации английский", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?lang=en");
    render(
      <AuthServerTextProvider lang="ru" strings={строкиAuth("ru")}>
        <I18nProvider>
          <ToastProvider>
            <AuthPage />
          </ToastProvider>
        </I18nProvider>
      </AuthServerTextProvider>,
    );
    await waitFor(() => expect(document.querySelector("main")?.textContent ?? "").toContain("Sign in to AEVION"));
    expect(document.querySelector("main")?.getAttribute("lang")).toBe("en");
    expect(document.querySelector("main")?.textContent ?? "").not.toContain("Вход в AEVION");
  });

  it("с провайдером: сервер дал ru, гость ru — русский держится и после гидрации (без кадра английского)", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?lang=ru");
    render(
      <AuthServerTextProvider lang="ru" strings={строкиAuth("ru")}>
        <I18nProvider>
          <ToastProvider>
            <AuthPage />
          </ToastProvider>
        </I18nProvider>
      </AuthServerTextProvider>,
    );
    // Наблюдаем за h1 всё время, пока провайдер определяет язык и качает словарь:
    // английский не должен появиться НИ В ОДНОМ кадре.
    const h1 = () => document.querySelector("main h1")?.textContent ?? "";
    const кадры = new Set<string>([h1()]);
    const наблюдатель = new MutationObserver(() => кадры.add(h1()));
    наблюдатель.observe(document.body, { subtree: true, childList: true, characterData: true });
    await waitFor(() => expect(document.querySelector("main")?.getAttribute("lang")).toBe("ru"));
    await new Promise((r) => setTimeout(r, 150));
    наблюдатель.disconnect();
    expect([...кадры]).toEqual(["Вход в AEVION"]);
  });
});
