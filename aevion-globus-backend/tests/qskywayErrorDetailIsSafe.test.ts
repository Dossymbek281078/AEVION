import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Поле `detail` в отказах не выдаёт устройство системы.
 *
 * ПОВОД. 28.08.2026 свип по catch-ам модуля показал непоследовательность: две
 * ручки шлют настоящий текст ошибки КЛИЕНТУ в поле `detail`, третья — только в
 * журнал. Рука тянулась дописать третьей, но правило платформы говорит
 * обратное: текст ошибки наружу выдаёт адрес, порт, имя пользователя базы и
 * поставщика. Значит вопрос не «дописать ли», а «что там вообще едет».
 *
 * Ронять хранилище на проде ради замера нельзя, поэтому спрашиваем то же самое
 * изнутри: подменяем пул на падающий с ТИПИЧНОЙ ошибкой postgres и читаем, что
 * уходит клиенту.
 *
 * Проверка НЕ требует, чтобы `detail` исчез: назвать причину полезно. Она
 * требует, чтобы в нём не было того, по чему строят карту нашей сети.
 */
// ⚠️ Падать надо ИЗБИРАТЕЛЬНО, и это не придирка.
//
// Если уронить и создание таблицы, модуль решит «базы нет вовсе», уйдёт в
// память и ответит 200 — ветка отказа не выполнится ни разу, а проверка будет
// зелёной и пустой. Первая версия этого теста именно так и промахнулась;
// поймал контроль прибора («не попали в ветку отказа»), а не догадка.
//
// Ветка 503 живёт в другом случае: база была доступна при старте, а потом
// отказала. Значит CREATE TABLE проходит, а SELECT падает.
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (/CREATE TABLE|CREATE INDEX/i.test(String(sql))) return { rows: [] };
      // Ровно так выглядит отказавший postgres: адрес и порт внутри текста.
      throw new Error("connect ECONNREFUSED 10.130.0.7:5432");
    },
  }),
}));

const LEAKY = [
  { what: "IPv4-адрес", re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { what: "порт базы", re: /:5432\b/ },
  { what: "имя пользователя базы", re: /\buser=|\brole "/ },
];

describe("detail в отказах не выдаёт устройство системы", () => {
  beforeEach(() => { vi.resetModules(); });

  test("нечитаемый рынок слотов: причина названа, адрес не показан", async () => {
    const { qskywayRouter } = await import("../src/routes/qskyway");
    const app = express();
    app.use(express.json());
    app.use("/api/qskyway", qskywayRouter);

    const res = await request(app).get("/api/qskyway/slots");
    // Контроль прибора: мы обязаны попасть именно в ветку отказа, иначе
    // «утечек нет» будет означать «я проверил успешный ответ».
    expect(res.status, "не попали в ветку отказа — подмена не сработала").toBe(503);
    expect(String(res.body?.error ?? ""), "причина не названа вовсе").not.toBe("");

    const body = JSON.stringify(res.body);
    for (const { what, re } of LEAKY) {
      expect(re.test(body), what + " уехал клиенту: " + body.slice(0, 160)).toBe(false);
    }
  });

  test("санитайзер держит РАЗНЫЕ формы ошибок postgres, а не одну", async () => {
    // Проверил на ECONNREFUSED и чуть не счёл закрытым. Postgres называет себя
    // по-разному, и каждая форма несёт своё опознавательное: имя пользователя,
    // имя роли, хост в строке подключения.
    const { safeDetail } = await import("../src/routes/qskyway");
    const формы: Array<[string, RegExp[]]> = [
      ["connect ECONNREFUSED 10.130.0.7:5432", [/10\.130/, /5432/]],
      ['password authentication failed for user "aevion_prod"', [/aevion_prod/]],
      ['role "aevion_prod" does not exist', [/aevion_prod/]],
      ["getaddrinfo ENOTFOUND db-primary.internal.aevion", [/internal\.aevion/]],
      ["connection to server at \"10.0.0.5\", port 5432 failed", [/10\.0\.0\.5/, /5432/]],
    ];
    for (const [raw, запрещено] of формы) {
      const out = safeDetail(new Error(raw));
      for (const re of запрещено) {
        expect(re.test(out), "форма «" + raw.slice(0, 40) + "» протекла: " + out).toBe(false);
      }
      // И причина не должна исчезнуть целиком: пустой detail хуже сырого —
      // он не отличает «база отказала» от «мы сломались».
      expect(out.length, "detail опустел на форме: " + raw.slice(0, 40)).toBeGreaterThan(5);
    }
  });
});
