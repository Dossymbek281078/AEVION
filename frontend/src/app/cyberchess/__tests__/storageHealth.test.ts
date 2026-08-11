import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

/* Проверка «плашка не лежит на нижней навигации» переехала в bottomOverlay.test.ts:
   отступ теперь считает общий помощник, и проверять его надо там, где он живёт, —
   вместе с двумя другими элементами, у которых была та же беда. Здесь оставались
   ассерты на конкретное выражение в разметке, и после выноса они покраснели, хотя
   поведение стало строже. Дублировать проверку в двух местах — верный способ
   получить красный тест на верном коде. */
