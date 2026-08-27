import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { modulesRouter } from "../src/routes/modules";
import { MODULE_RUNTIME } from "../src/data/moduleRuntime";

/**
 * Реестр модулей ищется по идентификатору из адреса. Обычный объект наследует
 * ключи прототипа, поэтому `MODULE_RUNTIME[id]` возвращал не «ничего», а
 * функцию — и проверка `if (!known)` её пропускала.
 *
 * Замер на живом проде 19.08.2026:
 *
 *   GET /api/modules/__no_such__/health  -> 404 {"ok":false,"error":"unknown module id"}
 *   GET /api/modules/constructor/health  -> 200 {"ok":true,"message":"Registry entry healthy"}
 *
 * То есть ручка объявляла ЗДОРОВЫМ модуль, которого не существует. Пять слов
 * проходили: constructor, __proto__, toString, valueOf, hasOwnProperty —
 * ручка не понижает регистр, поэтому работают все.
 *
 * Цена выше обычной: по этой ручке дашборд рисует зелёную точку у каждого
 * модуля. Зелёная точка на опечатку — проверка, которая успокаивает вместо
 * того, чтобы предупреждать.
 *
 * Тест закрывает класс на всех трёх ручках сразу, а не одну строку.
 */

const PROTO_IDS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];
const ENDPOINTS = ["health", "meta"];

function app() {
  const a = express();
  a.use(express.json());
  a.use(modulesRouter);
  return a;
}

describe("Реестр модулей: ключи прототипа — не модули", () => {
  test("несуществующий обычный идентификатор даёт 404 (контроль)", async () => {
    const r = await request(app()).get("/__no_such__/health");
    expect(r.status).toBe(404);
    expect(r.body.ok).toBe(false);
  });

  test("настоящий модуль отвечает 200 (контроль)", async () => {
    // Идентификатор берём из САМОГО реестра, а не угадываем форму ответа списка:
    // первая версия теста гадала и падала не на предмете проверки, а на своей
    // догадке.
    const id = Object.keys(MODULE_RUNTIME)[0];
    expect(typeof id).toBe("string");
    const r = await request(app()).get(`/${id}/health`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  for (const ep of ENDPOINTS) {
    test.each(PROTO_IDS)(`/${ep}: ключ %s не считается модулем`, async (id) => {
      const r = await request(app()).get(`/${id}/${ep}`);
      expect(r.status).toBe(404);
      // И главное — не «здоров».
      expect(r.body.ok).not.toBe(true);
    });
  }
});
