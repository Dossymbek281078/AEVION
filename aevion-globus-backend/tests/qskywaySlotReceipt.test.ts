import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter, __engineForTests, __slotStoreForTests } from "../src/routes/qskyway";

/**
 * Квитанция слота называлась «SHA-256-якорем» — словом, которым в этом же
 * модуле названа привязка слоя ограничений к Bitcoin через OpenTimestamps.
 * Разница между ними велика: якорь проверяется третьей стороной и доказывает
 * ВРЕМЯ, а квитанция — SHA-256 от нашей же записи в нашей же базе.
 *
 * Хуже имени было то, что проверить её было нечем: ручки не существовало.
 * Непроверяемая величина с сильным именем — украшение, а не гарантия.
 *
 * Здесь проверяется, что она стала настоящей: сходится на нетронутой записи,
 * НЕ сходится на изменённой, и что ответ сам называет границы — не якорь и не
 * доказательство времени.
 */
const app = express().use(express.json()).use("/api/qskyway", qskywayRouter);

async function book(routeId: string) {
  const r = await request(app).post("/api/qskyway/slots").send({
    routeId, t0: "2026-07-11T09:00:00Z", t1: "2026-07-11T09:03:00Z", holder: "проверка квитанции",
  });
  expect(r.status).toBe(201);
  return r.body.slot as { id: string; receipt: string };
}

describe("квитанция слота проверяема, и её граница названа", () => {
  test("на нетронутой записи квитанция сходится", async () => {
    const slot = await book("receipt-ok-" + Math.floor(Date.parse("2026-07-11") / 1000));
    const v = await request(app).get(`/api/qskyway/slots/${slot.id}/verify`);
    expect(v.status).toBe(200);
    expect(v.body.matches).toBe(true);
    expect(v.body.receipt).toBe(slot.receipt);
  });

  test("ответ сам говорит, что это НЕ якорь и НЕ доказательство времени", async () => {
    // Иначе проверка «сходится» прочитается как доказательство большего, чем
    // она даёт, — ровно та подмена, из-за которой понадобилась эта ручка.
    const slot = await book("receipt-scope-1");
    const v = await request(app).get(`/api/qskyway/slots/${slot.id}/verify`);
    expect(v.body.scope).toContain("НЕ якорь");
    expect(String(v.body.scopeEn)).toContain("NOT an external-ledger anchor");
  });

  test("несуществующий слот — это «не найден», а не «подделан»", async () => {
    const v = await request(app).get("/api/qskyway/slots/slot-нет-такого/verify");
    expect(v.status).toBe(404);
    expect(v.body.matches).toBeUndefined();
    expect(String(v.body.note)).toContain("не признак подделки");
  });

  test("выдача квитанции больше не называет её якорем", async () => {
    const r = await request(app).post("/api/qskyway/slots").send({
      routeId: "receipt-wording-1", t0: "2026-07-11T09:00:00Z", t1: "2026-07-11T09:03:00Z", holder: "проверка",
    });
    expect(r.status).toBe(201);
    expect(String(r.body.note)).toContain("контрольная сумма записи");
    expect(String(r.body.note)).not.toContain("якорь");
    expect(String(r.body.scope)).toContain("НЕ якорь во внешнем реестре");
  });

  test("нетронутая запись сходится, изменённая — нет", async () => {
    // Порядок важен: сначала утверждаем, что формула воспроизводит квитанцию на
    // ЦЕЛОЙ записи. Без этого «изменённая не сходится» ничего не значит —
    // функция, возвращающая случайное значение, прошла бы такую проверку.
    //
    // Запись берётся из хранилища, а не собирается руками: в ней есть поля
    // (`issued` — дата выдачи), которые тест не должен угадывать, иначе он
    // развалится на следующий день по причине, не имеющей отношения к делу.
    const slot = await book("receipt-tamper-1");
    const list = await request(app).get("/api/qskyway/slots");
    const stored = (list.body.slots as Record<string, unknown>[]).find((x) => x.id === slot.id);
    expect(stored, "бронь не попала в список — проверять нечего").toBeTruthy();
    const rec = {
      id: String(stored!.id), routeId: String(stored!.routeId), t0: String(stored!.t0),
      t1: String(stored!.t1), holder: String(stored!.holder), issued: String(stored!.issued),
      receipt: String(stored!.receipt),
    };

    expect(__engineForTests.slotReceipt(rec), "формула не воспроизводит квитанцию целой записи").toBe(slot.receipt);
    // И подмена ЛЮБОГО поля её меняет — не только держателя.
    expect(__engineForTests.slotReceipt({ ...rec, holder: "кто-то другой" })).not.toBe(slot.receipt);
    expect(__engineForTests.slotReceipt({ ...rec, t1: "2026-07-11T10:00:00Z" })).not.toBe(slot.receipt);
    expect(__engineForTests.slotReceipt({ ...rec, routeId: "другой-маршрут" })).not.toBe(slot.receipt);
  });

  test("ручка объявляет несходство, а не повторяет «сходится»", async () => {
    // Проверяется САМО СРАВНЕНИЕ внутри ручки, а не формула рядом с ним: подмена
    // `matches = true` проходила все остальные проверки этого файла незамеченной.
    const slot = await book("receipt-endpoint-tamper");
    const before = await request(app).get(`/api/qskyway/slots/${slot.id}/verify`);
    expect(before.body.matches).toBe(true);

    const stored = __slotStoreForTests.memSlots.find((x) => x.id === slot.id);
    expect(stored, "бронь не в памяти — тест проверяет не то").toBeTruthy();
    const original = stored!.holder;
    stored!.holder = "подменённый держатель";
    try {
      const after = await request(app).get(`/api/qskyway/slots/${slot.id}/verify`);
      expect(after.status).toBe(200);
      expect(after.body.matches).toBe(false);
      expect(String(after.body.note)).toContain("изменена");
    } finally {
      stored!.holder = original;
    }
  });
});
