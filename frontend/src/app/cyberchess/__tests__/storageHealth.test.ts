import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  writeJson,
  storageFailed,
  onStorageFailure,
  markStorageFailed,
  resetStorageHealth,
} from "../storageHealth";

/* Отказ записи прогресса раньше был неотличим от успеха: `try { setItem } catch {}`
   стоит и на настройках, где глотать правильно, и на истории партий с кошельком, где
   это тихая потеря заработанного. Здесь проверяется, что отказ виден. */

const KEY = "cc_test_storage_health";

describe("storageHealth", () => {
  beforeEach(() => {
    resetStorageHealth();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("удачная запись возвращает true и кладёт значение", () => {
    expect(writeJson(KEY, { a: 1 })).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ a: 1 });
    expect(storageFailed()).toBe(false);
  });

  it("отказ возвращает false и поднимает флаг", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      // так браузер ведёт себя при исчерпании квоты
      throw new DOMException("QuotaExceededError");
    });
    expect(writeJson(KEY, { a: 1 })).toBe(false);
    expect(storageFailed()).toBe(true);
  });

  it("слушателя дёргают один раз, а не на каждой неудачной записи", () => {
    const seen = vi.fn();
    onStorageFailure(seen);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    writeJson(KEY, 1);
    writeJson(KEY, 2);
    writeJson(KEY, 3);
    /* Предупреждение об одном и том же не должно всплывать после каждой партии —
       иначе его закроют не глядя, и оно перестанет работать. */
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("подписавшийся ПОСЛЕ отказа узнаёт о нём сразу", () => {
    markStorageFailed();
    const late = vi.fn();
    onStorageFailure(late);
    /* Отказ случается при сохранении партии, а баннер монтируется своим эффектом —
       порядок не гарантирован. Без этого поздний подписчик не узнал бы никогда. */
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("сломавшийся слушатель не мешает остальным узнать", () => {
    const ok = vi.fn();
    onStorageFailure(() => {
      throw new Error("я сломан");
    });
    onStorageFailure(ok);
    markStorageFailed();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("отписка работает", () => {
    const fn = vi.fn();
    const off = onStorageFailure(fn);
    off();
    markStorageFailed();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("предупреждение не перекрывает управление", () => {
  const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  const banner = page.slice(page.indexOf('{storageBroken&&<div role="alert"'), page.indexOf('{storageBroken&&<div role="alert"') + 1200);

  it("на телефоне поднято над нижней навигацией", () => {
    /* Плашка во всю ширину с z-index 9999 у самого низа накрывала бы BottomNav —
       а висит она до перезагрузки, то есть накрыла бы навсегда: человек не смог бы
       уйти со страницы, которая ему же сообщает о потере прогресса. */
    expect(banner).toMatch(/vwPx<769/);
    expect(banner).toMatch(/safe-area-inset-bottom/);
  });

  it("условие отступа совпадает с условием отрисовки навигации", () => {
    /* Два места, где написан один и тот же порог, — типовой источник расхождения:
       поменяют одно, забудут другое, и плашка снова ляжет на кнопки. */
    expect(page).toMatch(/!streamerMode&&vwPx<769&&<BottomNav/);
    expect(banner).toMatch(/\(!streamerMode&&vwPx<769\)\?/);
  });
});
