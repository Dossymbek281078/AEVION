/*
 * Кабинет бюро показывает работу гостя с той же почтой.
 *
 * 🔴 Замер на проде 30.10.2026: гость регистрирует работу на /qright с почтой,
 * затем создаёт аккаунт на ту же почту. GET /api/qright/objects?mine=1 → 1,
 * /api/pipeline/certificates/export.zip отдаёт запись, а GET /api/bureau/dashboard
 * отвечал certificates: 0 — выборка шла только по ownerUserId, у гостевой
 * записи он NULL.
 *
 * Правило владельца одно на три ручки (qright.ts, pipeline.ts, bureau.ts):
 * ownerUserId = sub токена, либо запись без ownerUserId с ownerEmail = почта токена.
 *
 * Мини-база повторяет tests/certificatesExportZip.test.ts: фильтр владельца
 * применяется ТОЛЬКО так, как он написан в SQL ручки. Убери запас по почте из
 * запроса — мок не найдёт гостевую запись, и тест станет красным.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

const SECRET = "test-jwt-secret-bureau-dashboard";
process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = SECRET;

type Obj = { id: string; ownerUserId: string | null; ownerEmail: string | null };
type Cert = { id: string; objectId: string; title: string; protectedAt: Date };
type User = { id: string; name: string; email: string };
const { db } = vi.hoisted(() => ({
  db: {
    users: [] as User[],
    objects: [] as Obj[],
    certs: [] as Cert[],
    sql: [] as string[],
  },
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = String(sql);
      db.sql.push(s);
      if (/SELECT "id","name","email" FROM "AEVIONUser"/.test(s)) {
        return { rows: db.users.filter((u) => u.id === params[0]) };
      }
      if (s.includes('FROM "IPCertificate" c') && s.includes('JOIN "QRightObject" o')) {
        const byUser = s.includes('o."ownerUserId" = $1');
        const byGuestEmail = s.includes('o."ownerUserId" IS NULL AND o."ownerEmail" = $2');
        const rows = db.certs
          .map((c) => ({ c, o: db.objects.find((o) => o.id === c.objectId) }))
          .filter(({ o }) => !!o)
          .filter(
            ({ o }) =>
              (byUser && o!.ownerUserId === params[0]) ||
              (byGuestEmail && o!.ownerUserId === null && o!.ownerEmail === params[1]),
          )
          .map(({ c }) => ({
            id: c.id,
            title: c.title,
            kind: "text",
            contentHash: "h",
            protectedAt: c.protectedAt,
            authorVerificationLevel: "anonymous",
            authorVerifiedAt: null,
            authorVerifiedName: null,
          }));
        return { rows };
      }
      // CREATE/ALTER TABLE, BureauVerification, BureauTrustEdge — пусто.
      return { rows: [], rowCount: 0 };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

const { bureauRouter } = await import("../src/routes/bureau");

const приложение = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/bureau", bureauRouter);
  return a;
};
const токен = (sub: string, email: string) =>
  jwt.sign({ sub, email, role: "user" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

const ПОЧТА = "guest-then-account@example.com";
const ЧУЖАЯ_ПОЧТА = "someone-else@example.com";
const НОВЫЙ = { id: "user-new-1", name: "Новый аккаунт", email: ПОЧТА };
const ЧУЖОЙ = { id: "user-other-1", name: "Другой", email: ЧУЖАЯ_ПОЧТА };

beforeEach(() => {
  db.users = [НОВЫЙ, ЧУЖОЙ];
  db.sql = [];
  db.objects = [
    // Гостевая запись: без ownerUserId, с почтой будущего аккаунта.
    { id: "obj-guest", ownerUserId: null, ownerEmail: ПОЧТА },
    // Своя запись после входа.
    { id: "obj-mine", ownerUserId: НОВЫЙ.id, ownerEmail: ПОЧТА },
    // Гостевая запись ДРУГОГО человека — показывать нельзя.
    { id: "obj-guest-other", ownerUserId: null, ownerEmail: ЧУЖАЯ_ПОЧТА },
    // Запись другого аккаунта, случайно с нашей почтой в поле — ownerUserId
    // главнее, показывать нельзя.
    { id: "obj-other-user", ownerUserId: ЧУЖОЙ.id, ownerEmail: ПОЧТА },
  ];
  db.certs = [
    { id: "cert-guest", objectId: "obj-guest", title: "Работа гостя", protectedAt: new Date("2026-10-29T10:00:00Z") },
    { id: "cert-mine", objectId: "obj-mine", title: "Работа после входа", protectedAt: new Date("2026-10-30T10:00:00Z") },
    { id: "cert-guest-other", objectId: "obj-guest-other", title: "Чужая гостевая", protectedAt: new Date("2026-10-28T10:00:00Z") },
    { id: "cert-other-user", objectId: "obj-other-user", title: "Чужого аккаунта", protectedAt: new Date("2026-10-27T10:00:00Z") },
  ];
});

describe("GET /api/bureau/dashboard — работа гостя с той же почтой", () => {
  test("без токена — 401 (контроль: ручка не стала анонимной)", async () => {
    const r = await request(приложение()).get("/api/bureau/dashboard");
    expect(r.status).toBe(401);
  });

  test("показывает сертификат гостя (ownerUserId NULL, ownerEmail = почта токена) и свой", async () => {
    const r = await request(приложение())
      .get("/api/bureau/dashboard")
      .set("Authorization", `Bearer ${токен(НОВЫЙ.id, ПОЧТА)}`);
    expect(r.status).toBe(200);
    const ids = (r.body.certificates as Array<{ id: string }>).map((c) => c.id).sort();
    expect(ids, "гостевая запись с той же почтой пропала из кабинета").toContain("cert-guest");
    expect(ids).toEqual(["cert-guest", "cert-mine"]);
  });

  test("чужая гостевая запись и запись другого аккаунта не показываются", async () => {
    const r = await request(приложение())
      .get("/api/bureau/dashboard")
      .set("Authorization", `Bearer ${токен(НОВЫЙ.id, ПОЧТА)}`);
    expect(r.status).toBe(200);
    const ids = (r.body.certificates as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain("cert-guest-other");
    expect(ids).not.toContain("cert-other-user");
  });

  test("SQL кабинета использует то же правило владельца, что qright/pipeline", async () => {
    await request(приложение())
      .get("/api/bureau/dashboard")
      .set("Authorization", `Bearer ${токен(НОВЫЙ.id, ПОЧТА)}`);
    const q = db.sql.find((s) => s.includes('FROM "IPCertificate" c') && s.includes('JOIN "QRightObject" o'));
    expect(q, "запрос сертификатов кабинета не найден").toBeTruthy();
    expect(q).toContain('o."ownerUserId" IS NULL AND o."ownerEmail" = $2');
  });
});
