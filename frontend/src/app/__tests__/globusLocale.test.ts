import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Язык подписей глобуса должен следовать за выбором пользователя.
 *
 * Поломка, ради которой написан тест: `detectLocale` читал ключ
 * `aevion:locale`, в который никто никогда не писал. Переключатель языка
 * сайта сохраняет выбор в `aevion_lang_v1`, поэтому глобус его не видел и
 * каждый раз брал язык браузера. Посетитель переключал сайт на русский —
 * названия стран на главной оставались английскими.
 *
 * Ошибки при этом не возникало: запасной путь (navigator.language)
 * отрабатывал штатно, и на машине с русским браузером всё выглядело верно.
 * Именно поэтому проверять надо КОНФЛИКТ: браузер английский, выбор русский.
 */

const SITE_LANG_KEY = "aevion_lang_v1";
const LEGACY_KEY = "aevion:locale";

// Импорт статический и лёгкий. Первая версия теста тянула сам Globus3D через
// динамический import и падала по таймауту в полном прогоне: три.js грузится
// дольше отведённых пяти секунд. Логика языка вынесена в отдельный модуль
// именно поэтому — тест не должен ждать трёхмерную сцену ради двух строк.
import { detectLocale, toGlobeLocale } from "@/app/components/globusLocale";

function setBrowserLang(lang: string) {
  vi.stubGlobal("navigator", { language: lang });
}

describe("глобус — язык подписей", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("следует за выбором пользователя, а не за языком браузера", () => {
    setBrowserLang("en-US");
    localStorage.setItem(SITE_LANG_KEY, "ru");
    // Ровно тот случай, который был сломан: браузер английский, выбор русский.
    expect(detectLocale()).toBe("ru");
  });

  it("понимает казахский из выбора сайта", () => {
    setBrowserLang("en-US");
    localStorage.setItem(SITE_LANG_KEY, "kk");
    expect(detectLocale()).toBe("kk");
  });

  it("остальные восемь языков сайта показывает по-английски", () => {
    setBrowserLang("ru-RU");
    for (const lang of ["de", "fr", "es", "zh", "ja", "ar", "pt", "tr"]) {
      expect(toGlobeLocale(lang)).toBe("en");
    }
    // И через сам detectLocale: выбран японский → подписи английские,
    // хотя браузер русский. Иначе получился бы язык, которого не выбирали.
    localStorage.setItem(SITE_LANG_KEY, "ja");
    expect(detectLocale()).toBe("en");
  });

  it("уважает устаревший ключ, если нового выбора ещё нет", () => {
    setBrowserLang("en-US");
    localStorage.setItem(LEGACY_KEY, "ru");
    // У тех, кто заходил раньше, значение лежит под старым именем. Молча
    // сбросить их на английский было бы регрессом, а не починкой.
    expect(detectLocale()).toBe("ru");
  });

  it("без сохранённого выбора берёт язык браузера", () => {
    setBrowserLang("kk-KZ");
    expect(detectLocale()).toBe("kk");
  });

  it("новый выбор перебивает устаревший ключ", () => {
    setBrowserLang("en-US");
    localStorage.setItem(LEGACY_KEY, "ru");
    localStorage.setItem(SITE_LANG_KEY, "kk");
    expect(detectLocale()).toBe("kk");
  });
});
