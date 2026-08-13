import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * `GET /verify` отвечал `valid: true` и отдавал публичный ключ, но молчал о
 * том, что ключ ВРЕМЕННЫЙ: без `QSKYWAY_SIGN_SK` он генерируется при старте
 * процесса. Подпись тогда доказывает лишь, что этот процесс подписал двойник
 * минуту назад, и ничего — о связи с прошлыми запусками.
 *
 * Оговорка при этом существовала: её несла сама запись подписи (`signCity`).
 * Ответ проверки её терял, и наружу шло голое «подпись верна». На проде ключ
 * именно временный (`/health` → qsign: preview, seed_unset), то есть оговорка
 * пропадала ровно там, где нужна.
 */
const app = express().use(express.json()).use("/api/qskyway", qskywayRouter);

describe("вердикт проверки подписи везёт свою оговорку", () => {
  test("ответ называет, временный ключ или постоянный", async () => {
    const r = await request(app).get("/api/qskyway/verify?city=astana");
    expect(r.status).toBe(200);
    expect(typeof r.body.ephemeral).toBe("boolean");
    expect(String(r.body.keyNote).length).toBeGreaterThan(20);
    expect(String(r.body.keyNoteEn).length).toBeGreaterThan(20);
  });

  test("при временном ключе сказано, что связи с прошлыми запусками нет", async () => {
    // В тестах `QSKYWAY_SIGN_SK` не задан, поэтому ключ временный — тот же
    // режим, что сейчас на проде.
    const r = await request(app).get("/api/qskyway/verify?city=astana");
    expect(r.body.ephemeral).toBe(true);
    expect(String(r.body.keyNote)).toContain("временный");
    expect(String(r.body.keyNote)).toContain("не связывает");
    expect(String(r.body.keyNoteEn)).toContain("ephemeral");
    // И вердикт по-прежнему на месте: оговорка его дополняет, а не заменяет.
    expect(r.body.valid).toBe(true);
  });

  test("повреждённый ключ считается временным, а не постоянным", async () => {
    // Признак раньше считался по НАЛИЧИЮ переменной. Повреждённое значение
    // (обрезанный base64, лишний перевод строки при вставке в Railway) молча
    // уходило в ветку с временным ключом, а модуль отвечал `ephemeral: false` —
    // обещал постоянный ключ ровно там, где человек ошибся руками.
    vi.resetModules();
    const prev = process.env.QSKYWAY_SIGN_SK;
    process.env.QSKYWAY_SIGN_SK = "это-не-base64-ключ";
    try {
      const { qskywayRouter: freshRouter } = await import("../src/routes/qskyway");
      const fresh = express().use(express.json()).use("/api/qskyway", freshRouter);
      const r = await request(fresh).get("/api/qskyway/verify?city=astana");
      expect(r.status).toBe(200);
      expect(r.body.ephemeral, "повреждённый ключ выдан за постоянный").toBe(true);
      expect(String(r.body.keyNote)).toContain("временный");
    } finally {
      if (prev === undefined) delete process.env.QSKYWAY_SIGN_SK; else process.env.QSKYWAY_SIGN_SK = prev;
      vi.resetModules();
    }
  });
});
