import { describe, it, expect, beforeEach } from "vitest";
import {
  AUTH_TOKEN_KEY,
  setAuthToken,
  clearAuthToken,
  syncTokenAliases,
  getAuthToken,
} from "@/lib/auth";

/**
 * Токен должен быть виден модулям, которые читают его под своими именами.
 *
 * Поломка 10.08.2026: 59 файлов читают `aevion_token` / `aevion_jwt`, а вход
 * пишет только `aevion_auth_token_v1`. Ни одна строка боевого кода эти имена
 * не писала — единственная запись во всём репозитории нашлась в e2e-тесте,
 * который сам клал токен в хранилище перед проверкой. Набор был зелёным
 * ровно потому, что готовил состояние, которого приложение не создаёт.
 *
 * Поэтому проверка идёт от ЧИТАТЕЛЯ: сначала «вошли», потом читаем так, как
 * читает случайная страница QCoreAI. Тест, который вызвал бы setAuthToken и
 * проверил getAuthToken, прошёл бы и на сломанном коде — он спрашивает у
 * того же владельца, который и записывал.
 */

const ALIASES = ["aevion_token", "aevion_jwt"];

/** Ровно так токен достаёт, например, src/app/qcoreai/batch/page.tsx. */
function readLikeAModulePage(): string {
  return localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token") || "";
}

describe("токен авторизации — псевдонимы", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("после входа модуль видит токен под своим именем", () => {
    setAuthToken("jwt-123");
    expect(readLikeAModulePage()).toBe("jwt-123");
  });

  it("все известные псевдонимы совпадают с каноническим значением", () => {
    setAuthToken("jwt-abc");
    for (const alias of ALIASES) {
      expect(localStorage.getItem(alias), `псевдоним ${alias}`).toBe("jwt-abc");
    }
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("jwt-abc");
  });

  it("выход стирает и псевдонимы — иначе рабочий токен остался бы лежать", () => {
    setAuthToken("jwt-xyz");
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
    expect(readLikeAModulePage()).toBe("");
    for (const alias of ALIASES) {
      expect(localStorage.getItem(alias), `псевдоним ${alias} после выхода`).toBeNull();
    }
  });

  it("уже вошедший пользователь получает псевдонимы при старте приложения", () => {
    // Состояние до правки: канонический ключ есть, псевдонимов нет, и
    // setAuthToken больше не вызовется — человек уже вошёл вчера.
    localStorage.setItem(AUTH_TOKEN_KEY, "jwt-old-session");
    expect(readLikeAModulePage()).toBe("");

    expect(syncTokenAliases()).toBe(true);
    expect(readLikeAModulePage()).toBe("jwt-old-session");
  });

  it("досинхронизация идемпотентна и не трогает неавторизованных", () => {
    expect(syncTokenAliases()).toBe(false);
    setAuthToken("jwt-1");
    expect(syncTokenAliases()).toBe(false); // всё уже на месте
  });

  it("смена токена обновляет псевдонимы, а не оставляет старый", () => {
    setAuthToken("jwt-first");
    setAuthToken("jwt-second");
    expect(readLikeAModulePage()).toBe("jwt-second");
  });
});
