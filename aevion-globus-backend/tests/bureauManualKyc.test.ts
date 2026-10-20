/*
 * 🔴 21.10.2026 — ручная проверка личности бюро (BUREAU_KYC_PROVIDER=manual).
 * Сторож держит три обещания запросами к ручкам, а не чтением кода:
 *   1. файлы документа и селфи видит ТОЛЬКО админ;
 *   2. через 30 дней после подачи байты стёрты — админ получает 410, не файл;
 *   3. пока флаг не manual, ручек нет (404), а барьер upgrade держит identity.
 * Знаменатели печатаются в именах тестов: 2 файла, 3 вида чужих запросов.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { manualKycRouter } from "../src/routes/bureauManualKyc";
import { memoryManualKycStore, MANUAL_KYC_RETENTION_DAYS, pgManualKycStore } from "../src/lib/kyc/manualStore";
import { manualKycProvider, __setManualKycStore } from "../src/lib/kyc/manualProvider";

// bureau.ts при импорте тянет базу и кошелёк — подмена как в bureauKycStubEscaping.test.ts.
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/routes/aev", () => ({ internalMintForDevice: vi.fn() }));

const DAY = 24 * 3600 * 1000;
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const PDF = Buffer.from("%PDF-1.4 test document");

function setup() {
  const store = memoryManualKycStore();
  let clock = new Date("2026-10-21T00:00:00Z");
  const audits: { action: string; actor: string | null }[] = [];
  let enabled = true;
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(
    "/api/bureau",
    manualKycRouter({
      store: () => store,
      enabled: () => enabled,
      isAdmin: (req) => {
        const a = String(req.headers.authorization || "");
        if (!a) return { ok: false, email: null, reason: "no-bearer" };
        if (a === "Bearer admin") return { ok: true, email: "admin@aevion.app", reason: null };
        return { ok: false, email: "user@x.test", reason: "not-in-allowlist" };
      },
      audit: async (o) => {
        audits.push({ action: o.action, actor: o.actor });
      },
      now: () => clock,
    }),
  );
  return {
    app,
    store,
    audits,
    tick: (ms: number) => (clock = new Date(clock.getTime() + ms)),
    disable: () => (enabled = false),
  };
}

const goodSubmit = {
  docType: "passport",
  docMime: "application/pdf",
  docBase64: PDF.toString("base64"),
  selfieMime: "image/png",
  selfieBase64: PNG.toString("base64"),
};

async function submitted(env: ReturnType<typeof setup>) {
  const s = await env.store.create({ userId: "u1", email: "author@x.test" }, new Date("2026-10-21T00:00:00Z"));
  const r = await request(env.app).post(`/api/bureau/kyc-manual/${s.id}/submit`).send(goodSubmit);
  expect(r.status).toBe(201);
  return s.id;
}

describe("ручная проверка личности: путь человека и админа", () => {
  test("подача → review, ответ человеку без файлов и с датой удаления через 30 дней", async () => {
    const env = setup();
    const id = await submitted(env);
    const r = await request(env.app).get(`/api/bureau/kyc-manual/${id}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("review");
    expect(r.body.retentionDays).toBe(30);
    expect(new Date(r.body.filesDeleteAfter).getTime() - new Date(r.body.submittedAt).getTime()).toBe(30 * DAY);
    expect(JSON.stringify(r.body)).not.toContain(PDF.toString("base64"));
    expect(r.body.reviewedBy).toMatch(/manual/);
  });

  test("неверные данные — 4xx: тип документа, mime, пустой файл, мусорный id, повторная подача", async () => {
    const env = setup();
    const s = await env.store.create({ userId: null, email: null }, new Date("2026-10-21T00:00:00Z"));
    const url = `/api/bureau/kyc-manual/${s.id}/submit`;
    expect((await request(env.app).post(url).send({ ...goodSubmit, docType: "selfie" })).status).toBe(400);
    expect((await request(env.app).post(url).send({ ...goodSubmit, docMime: "text/html" })).status).toBe(400);
    expect((await request(env.app).post(url).send({ ...goodSubmit, docBase64: "" })).status).toBe(400);
    expect((await request(env.app).post(url).send({ ...goodSubmit, selfieBase64: "<script>" })).status).toBe(400);
    expect((await request(env.app).post(`/api/bureau/kyc-manual/../../x/submit`).send(goodSubmit)).status).toBe(404);
    expect((await request(env.app).post(`/api/bureau/kyc-manual/kyc-man-zz/submit`).send(goodSubmit)).status).toBe(400);
    expect((await request(env.app).post(url).send(goodSubmit)).status).toBe(201);
    expect((await request(env.app).post(url).send(goodSubmit)).status).toBe(409);
  });

  test("файлы (2 из 2) видит только админ: без токена 401, чужой 403, админ получает байты и no-store", async () => {
    const env = setup();
    const id = await submitted(env);
    for (const kind of ["document", "selfie"] as const) {
      const url = `/api/bureau/admin/kyc-manual/${id}/file/${kind}`;
      expect((await request(env.app).get(url)).status).toBe(401);
      expect((await request(env.app).get(url).set("Authorization", "Bearer user")).status).toBe(403);
      const ok = await request(env.app).get(url).set("Authorization", "Bearer admin").buffer(true);
      expect(ok.status).toBe(200);
      expect(ok.headers["cache-control"]).toContain("no-store");
      expect(Buffer.compare(Buffer.from(ok.body), kind === "document" ? PDF : PNG)).toBe(0);
    }
    expect(env.audits.filter((a) => a.action === "kyc_manual_file_viewed").length).toBe(2);
    // очередь тоже только админу
    expect((await request(env.app).get(`/api/bureau/admin/kyc-manual`)).status).toBe(401);
    expect((await request(env.app).get(`/api/bureau/admin/kyc-manual`).set("Authorization", "Bearer user")).status).toBe(403);
  });

  test("решение: одобрение требует имени, отказ — причины; после решения повторно нельзя; getSession видит approved", async () => {
    const env = setup();
    const id = await submitted(env);
    const url = `/api/bureau/admin/kyc-manual/${id}/decide`;
    const A = { Authorization: "Bearer admin" };
    expect((await request(env.app).post(url).send({ decision: "approved", verifiedName: "X" })).status).toBe(401);
    expect((await request(env.app).post(url).set(A).send({ decision: "approved" })).status).toBe(400);
    expect((await request(env.app).post(url).set(A).send({ decision: "rejected" })).status).toBe(400);
    expect((await request(env.app).post(url).set(A).send({ decision: "maybe" })).status).toBe(400);
    const ok = await request(env.app)
      .post(url)
      .set(A)
      .send({ decision: "approved", verifiedName: "Author Name", verifiedCountry: "kz", verifiedDocType: "passport" });
    expect(ok.status).toBe(200);
    expect(ok.body.decidedBy).toBe("admin@aevion.app");
    expect(ok.body.verifiedCountry).toBe("KZ");
    expect((await request(env.app).post(url).set(A).send({ decision: "rejected", reason: "late" })).status).toBe(409);
    __setManualKycStore(env.store);
    try {
      const res = await manualKycProvider.getSession(id);
      expect(res.status).toBe("approved");
      expect(res.verifiedName).toBe("Author Name");
      expect(JSON.stringify(res.raw)).not.toContain("author@x.test");
    } finally {
      __setManualKycStore(null);
    }
  });
});

describe(`удаление документов через ${MANUAL_KYC_RETENTION_DAYS} дней (сторож удаления)`, () => {
  test("день 29 — админ видит файл; день 30 — 410 files_deleted для обоих файлов, решение и имя остаются", async () => {
    const env = setup();
    const id = await submitted(env);
    await request(env.app)
      .post(`/api/bureau/admin/kyc-manual/${id}/decide`)
      .set("Authorization", "Bearer admin")
      .send({ decision: "approved", verifiedName: "Author Name" });
    env.tick(29 * DAY);
    expect(
      (await request(env.app).get(`/api/bureau/admin/kyc-manual/${id}/file/document`).set("Authorization", "Bearer admin"))
        .status,
    ).toBe(200);
    env.tick(1 * DAY);
    for (const kind of ["document", "selfie"]) {
      const r = await request(env.app).get(`/api/bureau/admin/kyc-manual/${id}/file/${kind}`).set("Authorization", "Bearer admin");
      expect(r.status).toBe(410);
      expect(r.body.error).toBe("files_deleted");
    }
    // байтов нет в самом хранилище, а не только за ручкой
    const raw = env.store.__raw.get(id);
    expect(raw.docBytes).toBeNull();
    expect(raw.selfieBytes).toBeNull();
    const list = await request(env.app).get(`/api/bureau/admin/kyc-manual?status=approved`).set("Authorization", "Bearer admin");
    expect(list.body.count).toBe(1);
    expect(list.body.items[0].hasFiles).toBe(false);
    expect(list.body.items[0].verifiedName).toBe("Author Name");
    expect(list.body.items[0].purgedAt).not.toBeNull();
  });

  test("удаление срабатывает и без обращения к файлу: любая ручка (статус человека) чистит просроченные", async () => {
    const env = setup();
    const id = await submitted(env);
    env.tick(31 * DAY);
    await request(env.app).get(`/api/bureau/kyc-manual/${id}`);
    expect(env.store.__raw.get(id).docBytes).toBeNull();
  });

  test("SQL хранилища Postgres: purgeExpired обнуляет ОБА столбца байтов по purgeAfter <= now", async () => {
    const calls: string[] = [];
    const db = { query: vi.fn(async (sql: string) => (calls.push(sql), { rows: [], rowCount: 3 })) };
    const n = await pgManualKycStore(db).purgeExpired(new Date());
    expect(n).toBe(3);
    const purge = calls.find((c) => c.includes('"purgedAt"=$1'))!;
    expect(purge).toContain('"docBytes"=NULL');
    expect(purge).toContain('"selfieBytes"=NULL');
    expect(purge).toContain('"purgeAfter" <= $1');
    expect(purge).toContain('"purgedAt" IS NULL');
  });
});

describe("флаг выключен — ручек нет", () => {
  test("enabled=false → 404 kyc_manual_disabled на всех 3 видах запросов", async () => {
    const env = setup();
    const id = await submitted(env);
    env.disable();
    expect((await request(env.app).get(`/api/bureau/kyc-manual/${id}`)).status).toBe(404);
    expect((await request(env.app).post(`/api/bureau/kyc-manual/${id}/submit`).send(goodSubmit)).body.error).toBe(
      "kyc_manual_disabled",
    );
    expect(
      (await request(env.app).get(`/api/bureau/admin/kyc-manual/${id}/file/document`).set("Authorization", "Bearer admin"))
        .status,
    ).toBe(404);
  });
});

describe("барьер upgrade и флаг", () => {
  beforeEach(() => {
    delete process.env.BUREAU_ALLOW_STUB_COMMERCE;
  });
  test("stub → identity в барьере; manual → identity снят, payment (stub) держит 503", async () => {
    const { stubBarriersBlockingUpgrade } = await import("../src/routes/bureau");
    expect(stubBarriersBlockingUpgrade({ BUREAU_KYC_PROVIDER: "stub" } as NodeJS.ProcessEnv)).toEqual(["identity", "payment"]);
    expect(stubBarriersBlockingUpgrade({ BUREAU_KYC_PROVIDER: "manual" } as NodeJS.ProcessEnv)).toEqual(["payment"]);
  });
});
