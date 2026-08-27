import { describe, test, expect, beforeEach, vi } from "vitest";
import { loadLocale, DEFAULT_LOCALE } from "../i18n";

const CC_KEY = "aevion_locale";
const SITE_KEY = "aevion_lang_v1";

function setBrowserLang(v: string) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(v);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  setBrowserLang("ru-RU");
});

describe("язык шахмат следует за переключателем сайта", () => {
  test("выбор в шапке действует на шахматы", () => {
    window.localStorage.setItem(SITE_KEY, "en");
    // Браузер русский: до починки возвращалось "ru", то есть общий
    // переключатель на панели шахмат не действовал вовсе.
    expect(loadLocale()).toBe("en");
  });

  test("свой выбор в шахматах старше выбора в шапке", () => {
    window.localStorage.setItem(SITE_KEY, "en");
    window.localStorage.setItem(CC_KEY, "kk");
    expect(loadLocale()).toBe("kk");
  });

  test("языки сайта, которых нет у шахмат, уходят в английский, а не в русский", () => {
    for (const lang of ["de", "fr"]) {
      window.localStorage.setItem(SITE_KEY, lang);
      expect(loadLocale(), `язык сайта ${lang} увёл шахматы не туда`).toBe("en");
    }
  });

  test("мусор в ключе сайта не сбивает определение по браузеру", () => {
    window.localStorage.setItem(SITE_KEY, "эльфийский");
    setBrowserLang("en-US");
    expect(loadLocale()).toBe("en");
  });

  test("без обоих ключей работает прежнее определение по браузеру", () => {
    setBrowserLang("kk-KZ");
    expect(loadLocale()).toBe("kk");
    setBrowserLang("fr-FR");
    expect(loadLocale()).toBe(DEFAULT_LOCALE);
  });
});
