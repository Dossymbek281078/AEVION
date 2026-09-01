import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Публичная страница защищённой работы (`/qright/object/[id]`) — то, что автор
 * показывает миру. Она берёт данные о сертификате из
 * `GET /api/bureau/cert-for-qright/:qrightObjectId`.
 *
 * Замер 28.08.2026: ручка выбирала из базы четыре колонки —
 * `id, status, authorVerificationLevel, protectedAt` — и про якорь в биткойне
 * не говорила ВОВСЕ. То есть на странице, где запись должна отличаться от
 * строки в чьей-то базе, главное отличие было невидимо.
 *
 * Это шестая поверхность того же класса за вечер. Считать надо не вхождения
 * слова, а места, где ПОКАЗЫВАЮТ сертификат.
 */

let rows: Array<Record<string, unknown>> = [];
let seenSql: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      seenSql.push(String(sql));
      if (String(sql).includes('FROM "IPCertificate"')) return { rows };
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { bureauRouter } from "../src/routes/bureau";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/bureau", bureauRouter);
  return a;
};

const OBJ = "qr-object-0001";

beforeEach(() => {
  seenSql = [];
  rows = [
    {
      id: "cert-qr-0001",
      status: "active",
      authorVerificationLevel: "anonymous",
      protectedAt: new Date("2026-08-01T00:00:00Z"),
      otsStatus: "bitcoin-confirmed",
      otsBitcoinBlockHeight: "912345",
    },
  ];
});

const get = () => request(app()).get(`/api/bureau/cert-for-qright/${OBJ}`);

describe("страница защищённой работы получает состояние якоря", () => {
  test("в ответе есть bitcoinAnchor со статусом и высотой блока", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.body.bitcoinAnchor, "поля bitcoinAnchor нет").toBeDefined();
    expect(r.body.bitcoinAnchor.status).toBe("bitcoin-confirmed");
    expect(r.body.bitcoinAnchor.bitcoinBlockHeight).toBe(912345);
  });

  test("колонки якоря действительно ЗАПРОШЕНЫ у базы", async () => {
    // Подменённый пул не умеет «не отдать» колонку, которую забыли выбрать:
    // без этой проверки мутация «убрать otsStatus из SELECT» выжила бы, а на
    // живой базе якорь у всех записей стал бы «не якорено».
    await get();
    const sel = seenSql.filter((s) => s.includes("SELECT") && s.includes('FROM "IPCertificate"'));
    expect(sel.length).toBeGreaterThan(0);
    for (const q of sel) {
      expect(q).toContain(`"otsStatus"`);
      expect(q).toContain(`"otsBitcoinBlockHeight"`);
    }
  });

  test("не якорённая запись не выдаётся за ожидающую", async () => {
    rows[0].otsStatus = null;
    rows[0].otsBitcoinBlockHeight = null;
    const r = await get();
    expect(r.body.bitcoinAnchor.status).toBe("not_stamped");
    expect(r.body.bitcoinAnchor.bitcoinBlockHeight).toBeNull();
  });

  test("три состояния дают три разных ответа", async () => {
    const seen = new Set<string>();
    for (const s of [null, "pending", "bitcoin-confirmed"]) {
      rows[0].otsStatus = s;
      seen.add(String((await get()).body.bitcoinAnchor?.status));
    }
    expect(seen.size).toBe(3);
  });
});
