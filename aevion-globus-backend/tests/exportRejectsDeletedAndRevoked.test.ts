/*
 * 20.10.2026, замер на проде cde01b698: DELETE /api/auth/account → 200, а
 * GET /api/pipeline/certificates/export.zip тем же Bearer-токеном → 200 со
 * всеми записями. verifyBearerOptional смотрит подпись и tokenVersion;
 * deletedAt и AuthSession.revokedAt не видел никто, а DELETE /account не
 * поднимал tokenVersion.
 *
 * Здесь проверяется смысл, а не код ответа сам по себе:
 *  - удалённый аккаунт / отозванная сессия / сессии нет → 401 на выгрузке;
 *  - КОНТРОЛИ: живой аккаунт с sid и без sid → 200 и настоящий zip
 *    (иначе 401 доказывал бы только поломку ручки);
 *  - DELETE /account поднимает tokenVersion: старый токен перестаёт
 *    подходить в САМОЙ проверке токена (verifyBearerOptional) — значит, во
 *    всех 553 вызовах verifyBearerOptional(req) по src/routes/, а не только
 *    в выгрузке.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = "test-jwt-secret-export-deleted-revoked-32+";
process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = SECRET;

type User = { id: string; email: string; deletedAt: Date | null; tokenVersion: number };
type Sess = { id: string; userId: string; revokedAt: Date | null };
const { db } = vi.hoisted(() => ({
  db: {
    users: [] as User[],
    sessions: [] as Sess[],
    certs: [] as Record<string, unknown>[],
    bumpThrows: false,
    userQueryThrows: false,
  },
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = String(sql);
      if (/SELECT "deletedAt" FROM "AEVIONUser"/.test(s)) {
        if (db.userQueryThrows) throw new Error("connection refused");
        const u = db.users.find((x) => x.id === params[0]);
        return { rows: u ? [{ deletedAt: u.deletedAt }] : [], rowCount: u ? 1 : 0 };
      }
      if (/SELECT "revokedAt" FROM "AuthSession" WHERE "id" = \$1 AND "userId" = \$2/.test(s)) {
        const x = db.sessions.find((r) => r.id === params[0] && r.userId === params[1]);
        return { rows: x ? [{ revokedAt: x.revokedAt }] : [], rowCount: x ? 1 : 0 };
      }
      if (/SELECT "id", COALESCE\("tokenVersion", 0\) AS "tv" FROM "AEVIONUser"/.test(s)) {
        const rows = db.users.map((u) => ({ id: u.id, tv: u.tokenVersion }));
        return { rows, rowCount: rows.length };
      }
      if (/UPDATE "AEVIONUser" SET "tokenVersion"/.test(s)) {
        if (db.bumpThrows) throw new Error("bump failed (test)");
        const u = db.users.find((x) => x.id === params[0]);
        if (!u) return { rows: [], rowCount: 0 };
        u.tokenVersion += 1;
        return { rows: [{ tokenVersion: u.tokenVersion }], rowCount: 1 };
      }
      if (/UPDATE "AEVIONUser"[\s\S]*"deletedAt" = NOW\(\)/.test(s)) {
        const u = db.users.find((x) => x.id === params[2]);
        if (u) u.deletedAt = new Date();
        return { rows: [], rowCount: u ? 1 : 0 };
      }
      if (/UPDATE "AuthSession" SET "revokedAt" = NOW\(\) WHERE "userId" = \$1/.test(s)) {
        let n = 0;
        for (const x of db.sessions) if (x.userId === params[0] && !x.revokedAt) { x.revokedAt = new Date(); n++; }
        return { rows: [], rowCount: n };
      }
      if (/FROM "AuthSession"\s+WHERE "userId" = \$1/.test(s)) {
        const rows = db.sessions.filter((x) => x.userId === params[0]);
        return { rows, rowCount: rows.length };
      }
      if (/SELECT \* FROM "QRightObject"/.test(s) && /"ownerUserId" = \$1/.test(s)) {
        const rows = db.certs.filter((c) => c.ownerUserId === params[0]).map((c) => ({ id: c.objectId, title: c.title }));
        return { rows, rowCount: rows.length };
      }
      if (s.includes('FROM "IPCertificate" c') && s.includes('JOIN "QRightObject" o')) {
        const rows = db.certs.filter((c) => c.ownerUserId === params[0]);
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const tv = await import("../src/lib/tokenVersion");
const { verifyBearerOptional } = await import("../src/lib/authJwt");
const { verifyBearerLive } = await import("../src/lib/authLive");
const { pipelineRouter } = await import("../src/routes/pipeline");
const { authRouter } = await import("../src/routes/auth");
const { readZip } = await import("../src/lib/zipWriter");
const { qrightRouter } = await import("../src/routes/qright");

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  a.use("/api/auth", authRouter);
  a.use("/api/qright", qrightRouter);
  return a;
};

const токен = (sub: string, extra: Record<string, unknown> = {}) =>
  jwt.sign({ sub, email: `${sub}@bureau.kz`, role: "user", ...extra }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

function cert(id: string, ownerUserId: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const contentHash = crypto.createHash("sha256").update(id).digest("hex");
  const signedAt = new Date("2026-10-01T10:00:00Z");
  const signatureEd25519 = crypto.sign(null, Buffer.from(id, "utf8"), privateKey).toString("hex");
  return {
    id,
    objectId: `obj-${id}`,
    ownerUserId,
    shieldId: null,
    title: `Работа ${id}`,
    kind: "text",
    description: "d",
    authorName: "Owner",
    country: "KZ",
    city: "Astana",
    contentHash,
    algorithm: "SHA-256",
    protectedAt: signedAt,
    objectCreatedAt: signedAt,
    status: "active",
    publicKeyEd25519: spki.toString("hex"),
    signatureEd25519,
    signatureHmac: "00",
    signedAt,
    otsStatus: null,
    otsProof: null,
  };
}

function seed() {
  db.bumpThrows = false;
  db.userQueryThrows = false;
  db.users = [
    { id: "u-live", email: "u-live@bureau.kz", deletedAt: null, tokenVersion: 0 },
    { id: "u-deleted", email: "u-deleted@bureau.kz", deletedAt: new Date("2026-10-20T08:00:00Z"), tokenVersion: 0 },
  ];
  db.sessions = [
    { id: "s-live", userId: "u-live", revokedAt: null },
    { id: "s-revoked", userId: "u-live", revokedAt: new Date("2026-10-20T08:00:00Z") },
  ];
  db.certs = [cert("cert-live-1", "u-live"), cert("cert-live-2", "u-live"), cert("cert-del-1", "u-deleted")];
}

const выгрузка = (token: string) =>
  request(app())
    .get("/api/pipeline/certificates/export.zip")
    .set("Authorization", `Bearer ${token}`)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

beforeEach(() => {
  tv.__resetTokenVersionsForTests();
  seed();
});

describe("выгрузка export.zip закрыта для удалённого аккаунта и отозванной сессии (5 случаев выгрузки)", () => {
  test("(а) удалённый аккаунт (deletedAt), токен без sid → 401, 0 записей из 1", async () => {
    const r = await выгрузка(токен("u-deleted"));
    expect(r.status).toBe(401);
    expect(r.headers["content-type"]).not.toMatch(/zip/);
  });

  test("(а2) удалённый аккаунт, токен с ЖИВЫМ sid → 401 (deletedAt решает раньше сессии)", async () => {
    db.sessions.push({ id: "s-del-live", userId: "u-deleted", revokedAt: null });
    const r = await выгрузка(токен("u-deleted", { sid: "s-del-live" }));
    expect(r.status).toBe(401);
  });

  test("(б) живой аккаунт, sid с revokedAt → 401", async () => {
    const r = await выгрузка(токен("u-live", { sid: "s-revoked" }));
    expect(r.status).toBe(401);
  });

  test("(в) живой аккаунт, sid которого нет в AuthSession → 401, без записи «проверка не выполнена»", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await выгрузка(токен("u-live", { sid: "s-net-takoy" }));
    expect(r.status).toBe(401);
    // Отказ — осознанный, а не падение на undefined, пойманное catch-ем
    // (тот тоже даёт null, но пишет «проверка не выполнена»).
    expect(spy.mock.calls.map((c) => c.join(" ")).join(" | ")).not.toMatch(/authLive/);
    spy.mockRestore();
  });

  test("(в2) sid чужого пользователя → 401 (сессия ищется по паре id+userId)", async () => {
    db.users.push({ id: "u-other", email: "o@x", deletedAt: null, tokenVersion: 0 });
    const r = await выгрузка(токен("u-other", { sid: "s-live" }));
    expect(r.status).toBe(401);
  });

  test("(в3) строки AEVIONUser нет вовсе → 401, без записи «проверка не выполнена»", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await выгрузка(токен("u-net-v-baze"));
    expect(r.status).toBe(401);
    // Отказ — осознанный, а не падение на undefined, пойманное catch-ем
    // (тот тоже даёт null, но пишет «проверка не выполнена»).
    expect(spy.mock.calls.map((c) => c.join(" ")).join(" | ")).not.toMatch(/authLive/);
    spy.mockRestore();
  });

  test("(г) КОНТРОЛЬ: живой аккаунт, живой sid → 200 и zip с 2 записями из 2", async () => {
    const r = await выгрузка(токен("u-live", { sid: "s-live" }));
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/application\/zip/);
    const names = [...readZip(r.body as Buffer).keys()].sort();
    expect(names).toEqual(["cert-live-1/bundle.json", "cert-live-2/bundle.json", "index.json"]);
  });

  test("(д) КОНТРОЛЬ: живой аккаунт, токен без sid → 200 и zip с 2 записями из 2", async () => {
    const r = await выгрузка(токен("u-live"));
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/application\/zip/);
    expect(readZip(r.body as Buffer).size).toBe(3);
  });
});

describe("verifyBearerLive: сбой базы не выкидывает из сессии и не молчит (1 случай)", () => {
  test("ошибка запроса AEVIONUser → откат к проверке подписи (payload, не null → не 401) и console.error с маршрутом", async () => {
    db.userQueryThrows = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = {
      headers: { authorization: "Bearer " + токен("u-live") },
      method: "GET",
      baseUrl: "/api/pipeline",
      path: "/certificates/export.zip",
    } as any;
    const p = await verifyBearerLive(req);
    expect(p?.sub).toBe("u-live");
    const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/authLive/);
    expect(logged).toMatch(/откат к проверке подписи/);
    expect(logged).toMatch(/\/api\/pipeline\/certificates\/export\.zip/);
    spy.mockRestore();
  });
});

describe("DELETE /api/auth/account поднимает tokenVersion (2 случая)", () => {
  test("(е) после удаления старый токен не проходит САМУ проверку токена; КОНТРОЛЬ до удаления проходил", async () => {
    expect(await tv.loadTokenVersions()).toBe(true);
    const old = токен("u-live", { tv: 0, sid: "s-live" });
    const hdr = { headers: { authorization: "Bearer " + old } } as any;
    expect(tv.tokenVersionAccepted("u-live", 0)).toBe(true); // контроль
    expect(verifyBearerOptional(hdr)).not.toBeNull(); // контроль

    const d = await request(app()).delete("/api/auth/account").set("Authorization", `Bearer ${old}`);
    expect(d.status).toBe(200);
    expect(d.body).toEqual({ deleted: true });

    expect(tv.tokenVersionAccepted("u-live", 0)).toBe(false);
    expect(verifyBearerOptional(hdr)).toBeNull();
    expect(db.users.find((u) => u.id === "u-live")!.tokenVersion).toBe(1);
    // и выгрузка тем же токеном — 401
    expect((await выгрузка(old)).status).toBe(401);
  });

  test("(е2) отказ подъёма tokenVersion: удаление всё равно 200, а в журнале — запись", async () => {
    db.bumpThrows = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = await request(app()).delete("/api/auth/account").set("Authorization", `Bearer ${токен("u-live")}`);
    expect(d.status).toBe(200);
    expect(db.users.find((u) => u.id === "u-live")!.deletedAt).not.toBeNull();
    const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/tokenVersion НЕ поднят/);
    spy.mockRestore();
  });
});

describe("личные ручки вне выгрузки: тот же отказ (2 ручки × удалённый/отозванный/живой)", () => {
  const ручки = [
    { имя: "GET /api/auth/sessions", путь: "/api/auth/sessions" },
    { имя: "GET /api/qright/objects?mine=1", путь: "/api/qright/objects?mine=1" },
  ];
  for (const р of ручки) {
    test(`${р.имя}: удалённый → 401, отозванный sid → 401, КОНТРОЛЬ живой → 200`, async () => {
      const get = (t: string) => request(app()).get(р.путь).set("Authorization", `Bearer ${t}`);
      expect((await get(токен("u-deleted"))).status).toBe(401);
      expect((await get(токен("u-live", { sid: "s-revoked" }))).status).toBe(401);
      const ok = await get(токен("u-live", { sid: "s-live" }));
      expect(ok.status).toBe(200);
      // контроль по содержимому: 2 записи из 2 (сессии s-live+s-revoked / объекты cert-live-1+2)
      expect(ok.body.items?.length).toBe(2);
    });
  }
});
