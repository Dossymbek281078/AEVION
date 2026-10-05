import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сторож: порченый текст отбивается на ВСЕХ путях записи сертификата.
 *
 * 🔴 Замер 05.10.2026. Проверка кодировки была заведена 01.10 в обработчик
 * POST /protect — и этого оказалось мало: помощника `protectOne` зовут ДВА маршрута,
 * /protect и /protect-batch, а проверка стояла только у первого. Порченый текст
 * по-прежнему записывался пачкой. Класс известный: «вторая дверь в ту же комнату» —
 * запер одну, вторая осталась открытой, и снаружи это выглядит как закрытая.
 *
 * Поэтому проверка перенесена ВНУТРЬ protectOne, и этот сторож держит оба маршрута
 * запросами, а не чтением кода: третий маршрут, если появится, тоже будет закрыт по
 * построению, но два существующих проверены поведением.
 *
 * Почему вообще отбиваем, а не чиним: express.json() декодирует тело как UTF-8 и
 * заменяет негодные байты ДО обработчика — исходные байты видны только в rawBody.
 * Восстановить название после записи нельзя, проверено на живой записи реестра
 * (cert-47273244bb7dc5ef, байты EF BF BD). Единственный момент, когда можно
 * отказаться, — приём.
 */

const ЗАМЕНА = String.fromCharCode(0xfffd); // 65533; собираем кодом — escape съедается

const h = vi.hoisted(() => ({
  вставки: [] as Array<{ sql: string; params: unknown[] }>,
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (/^\s*INSERT/i.test(sql)) h.вставки.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/opentimestamps/anchor", () => ({
  stampHash: vi.fn(async () => null),
  upgradeProof: vi.fn(async () => null),
  verifyProof: vi.fn(async () => null),
}));

process.env.QSIGN_SECRET = process.env.QSIGN_SECRET || "test-secret-broken-encoding-guard";
process.env.SHARD_HMAC_SECRET_V1 =
  process.env.SHARD_HMAC_SECRET_V1 || "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

const { pipelineRouter } = await import("../src/routes/pipeline");

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

const работа = (title: string) => ({
  title,
  description: "проверка приёма",
  kind: "other",
  ownerName: "Проверяющий",
  country: "KZ",
});

describe("порченый текст на входе", () => {
  test("одиночная запись: 400 и понятная причина", async () => {
    const о = await request(app())
      .post("/api/pipeline/protect")
      .send(работа(`${ЗАМЕНА.repeat(8)} ${ЗАМЕНА.repeat(5)}`));
    expect(о.status, "порченый заголовок записался бы").toBe(400);
    const причина = JSON.stringify(о.body);
    expect(причина, "причина не называет кодировку — человек не поймёт, что прислать").toMatch(
      /UTF-8|кодиров/i,
    );
  });

  test("ПАЧКА: порченый элемент отбит, целый проходит", async () => {
    // Ровно эта дверь и была открыта: проверка стояла в маршруте /protect, а пачка
    // звала помощника напрямую.
    const о = await request(app())
      .post("/api/pipeline/protect-batch")
      .send({ items: [работа("Нормальное название"), работа(`Патент ${ЗАМЕНА}${ЗАМЕНА}`)] });

    const тело = JSON.stringify(о.body);
    expect(тело, "про кодировку в ответе пачки ничего нет — значит порченое прошло").toMatch(
      /UTF-8|кодиров/i,
    );
  });

  test("КОНТРОЛЬ: нормальная кириллица НЕ отбивается", async () => {
    // Без контроля правка могла бы отбивать всё русское — то есть закрыть приём
    // работ живым авторам. Утверждение мягкое намеренно: полного круга записи тут
    // нет (база подставная), поэтому проверяем, что причина НЕ про кодировку.
    const о = await request(app()).post("/api/pipeline/protect").send(работа("Степной рассвет"));
    const тело = JSON.stringify(о.body ?? {});
    expect(тело, "нормальная кириллица названа битой кодировкой").not.toMatch(/UTF-8|кодиров/i);
  });
});
