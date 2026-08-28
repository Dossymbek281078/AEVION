import { describe, test, expect } from "vitest";
import { safeErrorText } from "../src/lib/safeErrorText";

/**
 * Устройство нашей сети не уходит клиенту вместе с текстом ошибки.
 *
 * Класс найден соседней сессией в QSkyway (коммит 3df0a4fdc от 28.08.2026):
 * при отказе хранилища посетителю уходил внутренний адрес и порт базы. Здесь
 * та же логика вынесена в общий модуль и применяется в DevHub.
 *
 * Тексты ниже — НАСТОЯЩИЕ сообщения драйверов, а не выдуманные. Выдуманный
 * вход проверял бы мою фантазию: я бы придумал ровно то, что мой же код и
 * умеет прятать.
 */
describe("текст ошибки не выдаёт устройство системы", () => {
  const REAL = [
    "connect ECONNREFUSED 10.130.0.7:5432",
    "getaddrinfo ENOTFOUND db-primary.internal",
    'permission denied for role "devhub_rw"',
    "connection to server at 172.31.4.19, port 5432 failed: FATAL: password authentication failed for user=aevion_app",
  ];

  test("адреса, порты, роли и пользователи базы не проходят", () => {
    // Контроль прибора: список не должен быть пустым, иначе цикл ниже
    // «проходит» ничего не проверив.
    expect(REAL.length).toBeGreaterThan(3);
    for (const raw of REAL) {
      const out = safeErrorText(new Error(raw));
      expect(out, raw).not.toMatch(/[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}/);
      expect(out, raw).not.toContain("devhub_rw");
      expect(out, raw).not.toContain("aevion_app");
    }
  });

  test("причина остаётся видимой — иначе разбирать нечего", () => {
    // Обратный контроль: вычищать всё подряд так же плохо. «Не получилось»
    // без причины не отличает отказ базы от нашей поломки.
    const out = safeErrorText(new Error("connect ECONNREFUSED 10.130.0.7:5432"));
    expect(out).toContain("ECONNREFUSED");
  });

  test("длина ограничена — стек не уезжает клиенту", () => {
    const out = safeErrorText(new Error("x".repeat(5000)));
    expect(out.length).toBeLessThanOrEqual(200);
  });

  test("не падает на том, что вовсе не Error", () => {
    expect(safeErrorText(undefined)).toBe("undefined");
    expect(safeErrorText({ a: 1 })).toContain("object");
  });
});
