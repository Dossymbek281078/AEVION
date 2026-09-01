import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * ГОСТЕВАЯ ССЫЛКА: проверяется ПОВЕДЕНИЕ ручки, а не текст файла.
 *
 * Сторож devhubGuestLinkCannotStealPurchase читает ИСХОДНИК и убеждается,
 * что в нём есть нужные строки. Он пройдёт и тогда, когда маршрут вообще не
 * смонтирован или падает при вызове: наличие строки в файле и работающая
 * ручка — разные утверждения. Здесь ручку дёргают настоящим запросом.
 *
 * Главный проверяемый признак — НЕРАЗЛИЧИМОСТЬ ответа. Если «письмо ушло» и
 * «покупки нет» отвечают по-разному, любой желающий перебором адресов узнаёт,
 * кто у нас покупал. Утечка тихая: обе ветки выглядят исправными по
 * отдельности, и увидеть её можно только сравнив ответы друг с другом.
 */

const { mockRequest, mockConfirm } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock("../src/lib/devhubGuestLink", () => ({
  requestGuestLink: mockRequest,
  confirmGuestLink: mockConfirm,
  LINK_NEUTRAL: "Если покупка найдена, письмо со ссылкой уже в пути.",
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
  getPoolStats: () => null,
}));

// Предел частоты здесь поднят НАМЕРЕННО: он боевой (3 за десять минут), и
// пять проверок контракта выбрали бы его на третьей — остальные получали бы
// 429 и выглядели бы как поломка ручки. Сам ограничитель проверяется
// отдельным файлом devhubGuestLinkIsRateLimited, где он остаётся боевым:
// глушить защиту в тесте и нигде её не проверять — как раз то, чем тесты
// прячут настоящие дефекты. Переменная читается при регистрации маршрута,
// поэтому ставится ДО динамического импорта роутера.
process.env.DEVHUB_LINK_RATE_LIMIT = "100";

async function app() {
  const { devhubRouter } = await import("../src/routes/devhub.js");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("гостевая ссылка: контракт ручки", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockConfirm.mockReset();
  });

  test("«письмо ушло» и «покупки нет» неразличимы снаружи", async () => {
    const a = await app();

    mockRequest.mockResolvedValue("sent");
    const est = await request(a)
      .post("/api/devhub/guest/link-request")
      .send({ email: "kupil@example.com" });

    mockRequest.mockResolvedValue("no_purchase");
    const net = await request(a)
      .post("/api/devhub/guest/link-request")
      .send({ email: "ne-kupil@example.com" });

    // Ручка вообще смонтирована: без этого сравнение двух
    // одинаковых 404 прошло бы блестяще и не значило бы ничего.
    expect(est.status, "маршрут не смонтирован").toBe(200);
    expect(est.status).toBe(net.status);
    expect(JSON.stringify(est.body)).toBe(JSON.stringify(net.body));
    expect(mockRequest, "обработчик не звал связывание").toHaveBeenCalledTimes(2);
  });

  test("отказ хранилища не выдаётся за успех", async () => {
    const a = await app();
    mockRequest.mockResolvedValue("storage_down");
    const r = await request(a)
      .post("/api/devhub/guest/link-request")
      .send({ email: "kto@example.com" });
    expect(r.status, "отказ хранилища отвечает как успех").toBe(503);
    expect(r.body.ok).toBe(false);
  });

  test("отказ транспорта не выдаётся за успех", async () => {
    const a = await app();
    mockRequest.mockResolvedValue("transport_down");
    const r = await request(a)
      .post("/api/devhub/guest/link-request")
      .send({ email: "kto@example.com" });
    expect(r.status).toBe(503);
  });

  test("негодная ссылка — 400, а не 500: данные прислал клиент", async () => {
    const a = await app();
    mockConfirm.mockResolvedValue("invalid");
    const r = await request(a)
      .post("/api/devhub/guest/link-confirm")
      .send({ id: "x", token: "y" });
    // 500 ушла бы в Sentry и топила бы там настоящие аварии.
    expect(r.status, "ошибка клиента отвечает пятисоткой").toBe(400);
  });

  test("подтверждение отвечает успехом, когда связывание удалось", async () => {
    // Положительный контроль: без него первые проверки прошли бы и на ручке,
    // которая отвечает отказом ВСЕГДА.
    const a = await app();
    mockConfirm.mockResolvedValue("linked");
    const r = await request(a)
      .post("/api/devhub/guest/link-confirm")
      .send({ id: "x", token: "y" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
