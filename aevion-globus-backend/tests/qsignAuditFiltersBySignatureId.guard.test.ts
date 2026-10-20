/**
 * `/audit?signatureId=` отдаёт только эту подпись и только если её издатель —
 * тот, кто спрашивает.
 *
 * ПОВОД (20.10.2026). Кнопки «Отозвать подпись» на /qsign/verify/:id не было —
 * отзыв жил только в API. Публичная ручка id издателя наружу не отдаёт
 * (qsignPublicHidesSignerIdentity), поэтому страница узнаёт автора вопросом к
 * /audit с токеном: есть строка — автор, кнопку показать; пусто — нет.
 * Если фильтр перестанет работать, ответ останется 200 с items, и чужой
 * человек увидит кнопку на чужой подписи (бэк его всё равно не пустит, но
 * кнопка будет лгать). Сторож держит обе половины: своя подпись находится,
 * чужая — нет, и без signatureId журнал прежний.
 */

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const SECRET = "test-secret-qsign-audit-filter";

/** Две подписи: моя и чужая. */
const ПОДПИСИ = [
  { id: "sig-mine", issuerUserId: "user-me" },
  { id: "sig-other", issuerUserId: "user-other" },
];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (!sql.includes("WITH events AS")) return { rows: [], rowCount: 0 };
      /*
       * Заглушка исполняет ту часть SQL, которую проверяем: издателя ($1) и,
       * если в тексте есть условие на id, — id ($2). Решай она по params сама,
       * сторож проверял бы заглушку, а не ручку.
       */
      const поId = sql.includes('s."id" = $2');
      const rows = ПОДПИСИ.filter(
        (s) => s.issuerUserId === params[0] && (!поId || s.id === params[1]),
      ).map((s) => ({
        event: "sign",
        signatureId: s.id,
        revocationId: null,
        at: new Date().toISOString(),
        hmacKid: "k1",
        ed25519Kid: "k2",
        payloadHash: "h",
        geoCountry: null,
        reason: null,
        causalSignatureId: null,
        revokerUserId: null,
        revokedAt: null,
      }));
      return { rows, rowCount: rows.length };
    }),
  }),
}));

vi.mock("../src/lib/qsignV2/ensureTables", () => ({
  ensureQSignV2Tables: vi.fn(async () => {}),
}));

vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  getActiveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  getActiveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  resolveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  resolveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  getKeyByKid: async () => null,
  listKeys: async () => [],
  getActiveKey: async () => null,
}));

const спросить = async (query: string, sub = "user-me") => {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { qsignV2Router } = await import("../src/routes/qsignV2");
  const a = express();
  a.use("/api/qsign/v2", qsignV2Router);
  const токен = jwt.sign({ sub, email: `${sub}@example.test` }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  return request(a).get(`/api/qsign/v2/audit${query}`).set("Authorization", `Bearer ${токен}`);
};

describe("/audit?signatureId= — признак авторства для кнопки отзыва", () => {
  it("КОНТРОЛЬ: без signatureId журнал прежний — все мои подписи", async () => {
    const r = await спросить("?event=sign");
    expect(r.status).toBe(200);
    expect(r.body.items.map((x: any) => x.signatureId)).toEqual(["sig-mine"]);
  });

  it("моя подпись по id находится", async () => {
    const r = await спросить("?event=sign&limit=1&signatureId=sig-mine");
    expect(r.status).toBe(200);
    expect(r.body.items.map((x: any) => x.signatureId)).toEqual(["sig-mine"]);
  });

  it("чужая подпись по id — пусто, кнопки не будет", async () => {
    const r = await спросить("?event=sign&limit=1&signatureId=sig-other");
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
  });

  it("у владельца чужой подписи наоборот: своя есть, моя — нет", async () => {
    const r1 = await спросить("?event=sign&limit=1&signatureId=sig-other", "user-other");
    const r2 = await спросить("?event=sign&limit=1&signatureId=sig-mine", "user-other");
    expect(r1.body.items.length).toBe(1);
    expect(r2.body.items).toEqual([]);
  });

  it("без токена — 401, а не пустой список", async () => {
    process.env.AUTH_JWT_SECRET = SECRET;
    const { qsignV2Router } = await import("../src/routes/qsignV2");
    const a = express();
    a.use("/api/qsign/v2", qsignV2Router);
    const r = await request(a).get("/api/qsign/v2/audit?signatureId=sig-mine");
    expect(r.status).toBe(401);
  });
});
