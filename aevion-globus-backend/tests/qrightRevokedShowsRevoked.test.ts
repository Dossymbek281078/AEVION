import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Отозванное показывается отозванным — главное обещание QRight.
 *
 * Замер 28.08.2026: это обещание не было закреплено НИЧЕМ. Во всех четырёх
 * тестах модуля слово `revoke` встречалось ноль раз; единственная проверка,
 * покрывавшая петлю целиком (`scripts/qright-e2e-smoke.js`), выполниться не
 * может — ей нужна живая база, которой локально нет; а на проде отозванных
 * объектов ноль, то есть вживую отрицательную половину не проверить, не отозвав
 * настоящий чужой объект.
 *
 * На этом обещании стоит цепочка до патентного бюро, поэтому оно закрывается
 * здесь — подменой хранилища, без сети и без записи куда бы то ни было.
 *
 * Проверка ПАРНАЯ намеренно: тест только на отозванном был бы зелёным и у кода,
 * который рисует «отозвано» ВСЕГДА, а это так же бесполезно, как не показывать
 * отзыв вовсе.
 */

const h = vi.hoisted(() => ({ revokedAt: null as string | null }));

const HASH = "a".repeat(64);

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async (sql?: string) => {
      const s = String(sql ?? "");
      if (!s.includes("QRightObject")) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: "obj-1",
          title: "Чертёж узла",
          kind: "design",
          contentHash: HASH,
          ownerName: "Автор",
          country: "KZ",
          city: "Астана",
          createdAt: new Date("2026-08-01T10:00:00Z"),
          revokedAt: h.revokedAt ? new Date(h.revokedAt) : null,
          revokeReason: h.revokedAt ? "по требованию владельца" : null,
          revokeReasonCode: h.revokedAt ? "owner_request" : null,
          certificateId: null,
        }],
        rowCount: 1,
      };
    },
  }),
}));

vi.mock("../src/lib/ensureQRightTable", () => ({ ensureQRightTable: async () => {} }));

import { qrightRouter } from "../src/routes/qright";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qrightRouter);
  return a;
}

describe("QRight: отзыв виден снаружи", () => {
  test("объект не отозван — врезка говорит «registered»", async () => {
    h.revokedAt = null;
    const res = await request(app()).get("/x/embed/obj-1");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.status, "неотозванный объект показан отозванным").toBe("registered");
  });

  test("объект отозван — врезка говорит «revoked»", async () => {
    h.revokedAt = "2026-08-20T12:00:00Z";
    const res = await request(app()).get("/x/embed/obj-1");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(
      res.body.status,
      "отозванный объект по-прежнему показан действующим — это и есть та ложь, ради которой модуль существует",
    ).toBe("revoked");
  });

  test("причина отзыва доходит до врезки, а не теряется", async () => {
    // Без причины «отозвано» — это приговор без объяснения: тот, кому показали
    // значок, не знает, отозвал ли владелец сам или сработала жалоба.
    h.revokedAt = "2026-08-20T12:00:00Z";
    const res = await request(app()).get("/x/embed/obj-1");
    const body = JSON.stringify(res.body);

    expect(
      body.includes("owner_request") || body.includes("по требованию владельца"),
      "причина отзыва не дошла до врезки",
    ).toBe(true);
  });
});
