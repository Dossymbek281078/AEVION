import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { smetaTrainerRouter } from "../src/routes/smeta-trainer";

/**
 * Идентификатор устройства приходит из адреса и служит КЛЮЧОМ поиска в
 * обычном объекте: `students[deviceId]`. Обычный объект знает про ключи
 * прототипа, и проверка `isValidDeviceId` их пропускала — все пять длиннее
 * шести знаков и состоят из словарных символов.
 *
 * Замер 28.08.2026 (опыт на том же коде, до починки):
 *
 *   students["smeta-abc123"] -> {"student":{"displayName":"Иван"}}   верно
 *   students["нетакого"]     -> отбито проверкой                      верно
 *   students["__proto__"]    -> {"student":{}}     ручка ОБЪЯВЛЯЕТ ученика
 *   students["constructor"]  -> {}                 поля student НЕТ ВОВСЕ
 *
 * Утечки данных здесь нет — прототип пуст. Дефект в другом: ответ про
 * несуществующего ученика неотличим от ответа про существующего пустого, а
 * во втором случае у ответа пропадает поле, которое клиент читает без
 * проверки (`data.student.levels`). Та же проверка охраняет и ЗАПИСЬ:
 * синхронизация с таким идентификатором присваивает прототип вместо
 * свойства, и сохранение молча теряется.
 *
 * Сравниваем со СВОИМ контролем, а не с константой: если ручка вообще
 * перестанет отвечать, контроль покраснеет первым и не даст сторожу
 * позеленеть на сломанном.
 */

const PROTO_IDS = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"];
const UNKNOWN = "smeta-zzzzzzzzzz-control";

function app() {
  const a = express();
  a.use(express.json());
  a.use(smetaTrainerRouter);
  return a;
}

describe("Тренажёр сметчика: служебные ключи — не ученики", () => {
  test("контроль прибора: обычный несуществующий даёт student: null", async () => {
    const res = await request(app()).get(`/student/${UNKNOWN}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("student");
    expect(res.body.student).toBeNull();
  });

  for (const id of PROTO_IDS) {
    test(`«${id}» не выдаётся за ученика`, async () => {
      const res = await request(app()).get(`/student/${id}`);

      if (res.status === 400) return; // отбит проверкой — законный исход

      expect(res.status).toBe(200);
      // поле обязано БЫТЬ: без него клиент падает на data.student.levels
      expect(res.body).toHaveProperty("student");
      expect(res.body.student).toBeNull();
    });
  }
});
