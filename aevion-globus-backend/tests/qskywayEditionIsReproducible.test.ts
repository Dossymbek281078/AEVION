import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Третья сторона МОЖЕТ повторить наш хэш — и это проверено, а не обещано.
 *
 * ПОВОД (29.08.2026). Мы публиковали `contentHash` редакции воздушного
 * пространства и привязанное к Bitcoin доказательство на него, но НЕ
 * публиковали содержимое, над которым хэш взят: `signablePayload` жил только
 * внутри. Значит проверяющий мог подтвердить, что какой-то 32-байтовый
 * дайджест проштампован в таком-то блоке, и не мог проверить, что этот
 * дайджест относится к нашей редакции.
 *
 * Доказательство было неопровержимым в бесполезную сторону. Весь продукт
 * стоит на обещании «проверьте сами» — значит проверяемость и есть предмет.
 *
 * ⚠️ Этот тест повторяет путь ПРОВЕРЯЮЩЕГО, а не наш: берёт строку из ответа
 * и считает sha256 сам. Если бы он звал `airspaceContentHash()`, он проверял
 * бы, что наша функция равна самой себе.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("опубликованная редакция позволяет повторить хэш", () => {
  test("sha256 от payload из ответа совпадает с contentHash из ответа", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/edition?city=nyc");
    expect(res.status).toBe(200);
    expect(res.body.available, "у nyc должна быть редакция").toBe(true);
    expect(typeof res.body.payload, "payload не опубликован — проверить нечего").toBe("string");

    const mine = crypto.createHash("sha256").update(res.body.payload, "utf8").digest("hex");
    expect(mine, "хэш от опубликованной строки НЕ совпал с опубликованным хэшем").toBe(res.body.contentHash);
  });

  test("тот же хэш стоит и в блоке привязки — иначе проверять нечего", async () => {
    const edition = await request(app()).get("/api/qskyway/airspace/edition?city=nyc");
    const anchor = await request(app()).post("/api/qskyway/airspace/anchor").send({ city: "nyc" });
    expect(anchor.status).toBe(200);
    expect(
      anchor.body.contentHash,
      "привязка ссылается на другой хэш, чем опубликованная редакция",
    ).toBe(edition.body.contentHash);
  });

  test("payload не пуст и назван размером — чтобы обрезку было видно", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/edition?city=nyc");
    expect(res.body.payloadBytes).toBeGreaterThan(100);
    expect(Buffer.byteLength(res.body.payload, "utf8")).toBe(res.body.payloadBytes);
  });

  test("город без редакции отвечает честно, а не пустым payload", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/edition?city=astana");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.payload).toBeNull();
    expect(res.body.contentHash).toBeNull();
    // Отказ обязан НАЗВАТЬ причину на обоих языках.
    expect(String(res.body.note).length).toBeGreaterThan(20);
    expect(String(res.body.noteEn).length).toBeGreaterThan(20);
  });

  test("неизвестный город отбивается и НАЗЫВАЕТ, какие есть", async () => {
    // 404, а не 400: соглашение модуля — неизвестный ГОРОД это отсутствующий
    // ресурс. Первая версия теста ждала 400; ошибся тест, а не код.
    const res = await request(app()).get("/api/qskyway/airspace/edition?city=nope");
    expect(res.status).toBe(404);
    // Полезен не код, а список: проверяющему надо знать, что спрашивать.
    expect(Array.isArray(res.body.available)).toBe(true);
    expect(res.body.available).toContain("nyc");
    expect(String(res.body.errorEn).length).toBeGreaterThan(3);
  });

  test("служебное слово в имени города не пролезает", async () => {
    for (const bad of ["constructor", "__proto__", "toString"]) {
      const res = await request(app()).get("/api/qskyway/airspace/edition?city=" + bad);
      expect(res.status, bad + " не отбит").toBe(404);
    }
  });

  test("рецепт предупреждает о пересборке — это главная ловушка проверяющего", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/edition?city=nyc");
    const v = res.body.verifyYourself;
    expect(Array.isArray(v?.steps) && v.steps.length >= 3).toBe(true);
    expect(Array.isArray(v?.stepsEn) && v.stepsEn.length === v.steps.length).toBe(true);
    // Без этого предупреждения честный проверяющий пересоберёт JSON, получит
    // другой хэш и решит, что мы врём — хотя врал бы формат.
    expect(String(v?.warning).toLowerCase()).toContain("пересборк");
    expect(String(v?.warningEn).toLowerCase()).toContain("rebuild");
  });
});

/**
 * Хэш в сводке и хэш редакции — одно и то же число.
 *
 * ПОВОД. `airspaceSummary` не несла contentHash вовсе: потребитель знал, ЧТО
 * за источник, и не знал, КАКАЯ редакция перед ним. Добавив поле, надо сразу
 * запретить ему разойтись со вторым ответом — иначе через месяц два места
 * будут называть разные числа, и оба уверенно.
 */
describe("сводка и редакция называют один хэш", () => {
  test("contentHash из /cities совпадает с contentHash из /airspace/edition", async () => {
    // ⚠️ Параметр называется `city`, а не `id`. Первая версия послала `?id=nyc`,
    // получила ГОРОД ПО УМОЛЧАНИЮ (без сетки потолков) и выглядела как находка
    // «два наших ответа противоречат друг другу». Спросил не тем именем.
    const city = await request(app()).get("/api/qskyway/city?city=nyc");
    const edition = await request(app()).get("/api/qskyway/airspace/edition?city=nyc");
    expect(edition.body.contentHash, "у редакции нет хэша").toBeTruthy();
    const summaryHash = city.body?.airspace?.contentHash;
    expect(summaryHash, "в сводке нет contentHash — поле потеряно").toBeTruthy();
    expect(summaryHash, "сводка и редакция называют РАЗНЫЕ хэши").toBe(edition.body.contentHash);
  });
});
