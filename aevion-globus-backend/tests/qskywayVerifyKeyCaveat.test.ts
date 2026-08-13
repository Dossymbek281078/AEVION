import { describe, test, expect } from "vitest";
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
});
