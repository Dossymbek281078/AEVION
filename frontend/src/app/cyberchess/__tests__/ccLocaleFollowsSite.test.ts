import { describe, test, expect, beforeEach, vi } from "vitest";
import { loadLocale, DEFAULT_LOCALE } from "../i18n";

const CC_KEY = "aevion_locale";
const SITE_KEY = "aevion_lang_v1";

function setBrowserLang(v: string) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(v);
}

function setSiteCookie(v: string) {
  document.cookie = `${SITE_KEY}=${encodeURIComponent(v)}; path=/`;
}

function clearSiteCookie() {
  document.cookie = `${SITE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

beforeEach(() => {
  window.localStorage.clear();
  clearSiteCookie();
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

  // 🔴 Регресс 08.09.2026: выбор языка платформы приходит КУКОЙ (setLang в
  // lib/i18n.tsx, SSR-страницы читают её на сервере), а не только localStorage.
  // /cyberchess читал лишь localStorage — и в cookie-сценарии (замер соседнего
  // окна: cookie=en, браузер RU → 88% кириллицы) оставался на языке браузера,
  // пока /qventure и /bureau слушались. Прежний тест ставил localStorage и
  // потому дефект не ловил (state, которого прод в этом сценарии не создаёт).
  test("выбор языка платформы КУКОЙ действует на шахматы (без localStorage)", () => {
    setSiteCookie("en"); // браузер русский, localStorage пуст — только кука
    expect(loadLocale()).toBe("en");
  });

  test("свой выбор шахмат старше куки платформы", () => {
    setSiteCookie("en");
    window.localStorage.setItem(CC_KEY, "kk");
    expect(loadLocale()).toBe("kk");
  });

  test("кука с языком сайта вне трёх наших уходит в английский", () => {
    setSiteCookie("de");
    expect(loadLocale()).toBe("en");
  });
});
