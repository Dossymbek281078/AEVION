/**
 * Словарь посетителя начинает качаться сразу при загрузке модуля переводов,
 * ещё до того, как провайдер смонтирован.
 *
 * Зачем. Замер 15.09.2026: на телефоне (Slow 4G) русскоязычный посетитель без
 * куки 9,3 с видел английский сайт, потому что словарь начинал качаться только
 * из эффекта провайдера — после гидрации. Первый рендер обязан остаться "en",
 * но скачивание может и должно идти параллельно.
 *
 * Проверяем без провайдера вовсе: если словарь появился, его запросил модуль.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

const ORIGINAL_LANGUAGE = navigator.language;

function setBrowserLang(value: string) {
  Object.defineProperty(window.navigator, "language", { value, configurable: true });
}

afterEach(() => {
  setBrowserLang(ORIGINAL_LANGUAGE);
  try { localStorage.clear(); } catch { /* окружение без хранилища */ }
  document.cookie = "aevion_lang_v1=; path=/; max-age=0";
  vi.resetModules();
});

describe("словарь качается до монтирования провайдера", () => {
  it("браузер ru без куки: ru-словарь приходит без провайдера", async () => {
    setBrowserLang("ru-RU");
    vi.resetModules();
    const mod = await import("../i18n");
    await vi.waitFor(() => expect(mod.peekDict("ru"), "ru-словарь не запрошен при загрузке модуля").toBeDefined(), {
      timeout: 5000,
    });
  });

  it("кука kk сильнее языка браузера ru", async () => {
    setBrowserLang("ru-RU");
    document.cookie = "aevion_lang_v1=kk; path=/";
    vi.resetModules();
    const mod = await import("../i18n");
    await vi.waitFor(() => expect(mod.peekDict("kk")).toBeDefined(), { timeout: 5000 });
    expect(mod.peekDict("ru"), "качнули язык браузера вместо выбора человека").toBeUndefined();
  });

  it("контроль en: лишних словарей не качаем", async () => {
    setBrowserLang("en-US");
    vi.resetModules();
    const mod = await import("../i18n");
    await new Promise((r) => setTimeout(r, 300));
    expect(mod.peekDict("ru")).toBeUndefined();
    expect(mod.peekDict("kk")).toBeUndefined();
    expect(mod.peekDict("en"), "английский встроен всегда").toBeDefined();
  });
});
