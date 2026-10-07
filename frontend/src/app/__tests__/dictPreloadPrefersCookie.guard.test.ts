/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { скриптПредзагрузкиСловаря } from "@/lib/dictPreloadScript";

const DICT_PRELOAD_SCRIPT = скриптПредзагрузкиСловаря("test-commit");

/**
 * Предзагрузка словаря обязана слушать КУКУ, а не устаревшее хранилище.
 *
 * Повод, а не гипотеза. Замер 07.10.2026: у посетителя кука `aevion_lang_v1=en`
 * и `localStorage` со значением `ru` расходились, и выигрывало хранилище —
 * страница выходила русской при английской куке, а соседний скрипт ставил при
 * этом `lang="en"`.
 *
 * Как источники расходятся у живого человека: куку языка ставит не только
 * переключатель, но и `middleware.ts` — при переадресации с `/en/...` на
 * канонический адрес (308) он выставляет `aevion_lang_v1=en` НА СЕРВЕРЕ и
 * хранилище не трогает, потому что с сервера до него не дотянуться.
 *
 * Проверяем ПОВЕДЕНИЕ: исполняем сам скрипт с подменёнными источниками и
 * смотрим, какой язык он выбрал. Сторож, сверяющий порядок строк в тексте,
 * проверял бы замысел — условия можно переставить, не меняя смысла, и наоборот.
 */

function выбранныйЯзык(opts: {
  путь?: string;
  кука?: string | null;
  хранилище?: string | null;
  языкБраузера?: string;
}): string | null {
  // Чистим состояние между случаями: иначе второй случай читает первый.
  window.localStorage.clear();
  for (const c of document.cookie.split("; ")) {
    const имя = c.split("=")[0];
    if (имя) document.cookie = `${имя}=; max-age=0; path=/`;
  }
  delete (window as unknown as Record<string, unknown>).__aevionDict;

  if (opts.хранилище) window.localStorage.setItem("aevion_lang_v1", opts.хранилище);
  if (opts.кука) document.cookie = `aevion_lang_v1=${opts.кука}; path=/`;
  window.history.replaceState({}, "", opts.путь ?? "/");
  Object.defineProperty(window.navigator, "language", {
    value: opts.языкБраузера ?? "en-US",
    configurable: true,
  });
  // Скрипт в конце дёргает fetch за словарём — он нам не нужен, но без заглушки
  // падение улетит в catch и мы не отличим «не выбрал» от «упал».
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));

  // eslint-disable-next-line no-new-func
  new Function(DICT_PRELOAD_SCRIPT)();
  const d = (window as unknown as { __aevionDict?: { lang: string } }).__aevionDict;
  return d ? d.lang : null;
}

describe("предзагрузка словаря слушает куку, а не устаревшее хранилище", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("прибор видит предмет: скрипт непустой и что-то выбирает", () => {
    expect(DICT_PRELOAD_SCRIPT.length).toBeGreaterThan(200);
    expect(DICT_PRELOAD_SCRIPT).toContain("aevion_lang_v1");
    expect(выбранныйЯзык({ хранилище: "ru" })).toBe("ru");
  });

  it("🔴 кука сильнее хранилища — тот самый случай 07.10", () => {
    expect(выбранныйЯзык({ кука: "en", хранилище: "ru" })).toBe(null);
  });

  it("и в обратную сторону: кука ru при хранилище en даёт ru", () => {
    expect(выбранныйЯзык({ кука: "ru", хранилище: "en" })).toBe("ru");
  });

  it("адрес сильнее обоих: /en/... выигрывает у куки ru", () => {
    expect(выбранныйЯзык({ путь: "/en/longevity", кука: "ru", хранилище: "ru" })).toBe(null);
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: без куки хранилище по-прежнему работает", () => {
    expect(выбранныйЯзык({ хранилище: "kk" })).toBe("kk");
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: без обоих берётся язык браузера", () => {
    expect(выбранныйЯзык({ языкБраузера: "ru-RU" })).toBe("ru");
  });
});
