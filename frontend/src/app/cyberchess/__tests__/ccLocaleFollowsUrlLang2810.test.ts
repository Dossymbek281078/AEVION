import { describe, test, expect, beforeEach, vi } from "vitest";
import { loadLocale } from "../i18n";

// 28.10.2026: /cyberchess?lang=en при браузере ru-RU давал html.lang=en, но 71 видимую
// русскую строку лобби: провайдер сайта слушался ?lang=, шахматы — нет.
function openUrl(search: string) {
  window.history.replaceState({}, "", "/cyberchess" + search);
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "aevion_lang_v1=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  vi.restoreAllMocks();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("ru-RU");
  openUrl("");
});

describe("язык шахмат следует за ?lang= в адресе", () => {
  test("?lang=en при русском браузере даёт en", () => {
    openUrl("?lang=en");
    expect(loadLocale()).toBe("en");
  });
  test("?lang=kk даёт kk, ?lang=de уходит в en", () => {
    openUrl("?lang=kk");
    expect(loadLocale()).toBe("kk");
    openUrl("?lang=de");
    expect(loadLocale()).toBe("en");
  });
  test("метка письма mail-* означает en", () => {
    openUrl("?c=mail-coaches");
    expect(loadLocale()).toBe("en");
  });
  test("без ?lang= и при русском браузере остаётся ru (контроль)", () => {
    expect(loadLocale()).toBe("ru");
  });
  test("мусор в ?lang= не сбивает определение", () => {
    openUrl("?lang=эльфийский");
    expect(loadLocale()).toBe("ru");
  });
});
