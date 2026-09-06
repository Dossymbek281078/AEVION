import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Сторож: возврат денег по разовой покупке «Bureau Verified» оставляет след.
 *
 * ЧТО БЫЛО (замер 01.09.2026). Ветка возврата отвечала `ignored` и не трогала
 * запись вовсе: "paymentStatus" навсегда оставался 'paid'. Деньги вернули, а
 * наши собственные данные говорили «оплачено». Единственным следом был
 * console.log, а на проде хранилище — память процесса, то есть следа нет.
 *
 * ЧЕГО ЭТОТ СТОРОЖ НАМЕРЕННО НЕ ТРЕБУЕТ. Он не требует ОТЗЫВА значка.
 * Проверка личности реально проводилась, и отзывать её за денежный спор —
 * решение основателя. Сторож охраняет ровно две вещи:
 *   1) возврат оставляет запись в журнале аудита;
 *   2) ворота значка при этом НЕ трогаются.
 * Если основатель решит отзывать — второе утверждение меняют осознанно,
 * а не забывают.
 */

// vi.hoisted обязателен: фабрика vi.mock поднимается ВЫШЕ объявлений, и
// массив, объявленный обычным const, к моменту подмены ещё не существует.
// Первая версия этого файла молча не записывала НИЧЕГО — и проверка
// «ворота не тронуты» была зелёной ровно потому, что массив всегда пуст.
let счётчик = 0;
const { обновления } = vi.hoisted(() => ({ обновления: [] as string[] }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// Ветка достигается ШТАТНЫМ путём — переопределением по product_id
// (resolveReference, шаг 2), а не подделкой внутренностей обработчика.
process.env.GUMROAD_PRODUCT_BUREAU = "bureau-verified";

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      обновления.push(sql);
      return { rowCount: 0, rows: [] };
    },
  }),
}));

beforeEach(() => {
  обновления.length = 0;
});

async function возврат(status: "refunded" | "failed") {
  const express = (await import("express")).default;
  const request = (await import("supertest")).default;
  const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");
  const app = express();
  // Монтируем ТАК ЖЕ, как боевое приложение: обработчик читает СЫРОЕ тело
  // (parseWebhook разбирает строку сам и по ней же считает подпись), а
  // заполняет его колбэк verify. Без него req.rawBody пуст, разбор отдаёт
  // no_email — и тест меряет собственную сборку вместо продукта.
  app.use(
    express.urlencoded({
      extended: true,
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use("/api/gumroad", gumroadWebhookRouter);
  return request(app)
    .post("/api/gumroad/webhook")
    .type("form")
    .send({
      // Идентификатор ОБЯЗАН быть уникальным на каждый вызов: у обработчика
      // есть дедупликация, и повтор того же sale_id отсекается ДО ветки.
      // Из-за общего идентификатора два теста молча не доходили до кода
      // и выглядели как «запись не легла».
      sale_id: `s_${status}_${++счётчик}`,
      email: "buyer@example.test",
      product_id: "bureau",
      price: "4900",
      refunded: status === "refunded" ? "true" : "false",
      // Второе поле — чтобы ветка失 не зависела от одного признака.
      ...(status === "failed" ? { chargebacked: "true" } : {}),
    });
}

describe("возврат по «бюро» оставляет след", () => {
  test("КОНТРОЛЬ: обработчик вообще отвечает на этот товар", async () => {
    const res = await возврат("refunded");
    expect(res.status).toBe(200);
    expect(
      JSON.stringify(res.body),
      "запрос ушёл в другую ветку — проверять нечего"
    ).toMatch(/bureau/);
  });

  test("возврат ЗАПИСАН в журнал аудита", async () => {
    await возврат("refunded");
    const аудит = обновления.filter((q) => /INSERT INTO "BureauAuditLog"/.test(q));
    expect(аудит.length, "возврат не оставил записи в журнале аудита").toBeGreaterThan(0);
  });

  test("КОНТРОЛЬ: подмена соединения ВООБЩЕ записывает запросы", async () => {
    await возврат("refunded");
    expect(
      обновления.length,
      "не записано ни одного запроса — подмена не работает, и любой вывод об SQL ничего не значит"
    ).toBeGreaterThan(0);
  });

  test("ворота значка НЕ тронуты: paymentStatus не переписан", async () => {
    await возврат("refunded");
    const тронул = обновления.filter((s) => /UPDATE[\s\S]*paymentStatus/i.test(s));
    expect(
      тронул,
      "ветка трогает paymentStatus — это молча отзовёт значок, а решение за основателем"
    ).toEqual([]);
  });
});
