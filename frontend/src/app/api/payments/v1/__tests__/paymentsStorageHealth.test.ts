import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "../health/route";

/**
 * Сторож: снаружи видно, переживут ли платёжные записи перезапуск.
 *
 * ЗАЧЕМ. Слой хранения умеет уходить на память процесса и знает об этом
 * (kvBackend, kvDegradedSince, проверяемые чтения). Замер 29.08.2026:
 * проверяемые чтения не звал НИКТО, состояние наружу не отдавалось нигде.
 * Возвраты, споры и аудит могли писаться в исчезающую Map, и каждый ответ
 * выглядел нормальным.
 *
 * Проверяем и обратное свойство: наружу уходит ОТВЕТ, а не устройство
 * системы — имени хранилища в теле быть не должно.
 */
const КЛЮЧИ = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
const снимок: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of КЛЮЧИ) {
    снимок[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of КЛЮЧИ) {
    if (снимок[k] === undefined) delete process.env[k];
    else process.env[k] = снимок[k];
  }
});

describe("состояние платёжного хранилища видно снаружи", () => {
  it("без настроенного хранилища честно говорит, что записи не переживут перезапуск", async () => {
    const res = await GET();
    const тело = await res.json();
    expect(тело.durable, "ручка обещает долговременность, которой нет").toBe(false);
    expect(String(тело.note)).toContain("исчезнут при перезапуске");
  });

  it("устройство системы наружу не уходит", async () => {
    const res = await GET();
    const текст = JSON.stringify(await res.json());
    for (const слово of ["kv", "KV", "upstash", "Upstash", "redis", "Redis"]) {
      expect(текст, `в ответе видно имя хранилища: ${слово}`).not.toContain(слово);
    }
  });
});
