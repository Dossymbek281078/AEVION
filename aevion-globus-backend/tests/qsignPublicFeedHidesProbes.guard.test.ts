/*
 * 🔴 19.10.2026 (Продукт): публичные /recent и /stats QSign не кормятся нашими пробами.
 * Замер на проде 19.10: один прогон пути гостя поднял total 51→53 и издателей 26→27,
 * витрина вела на пробу. Сторож печатает ЗНАМЕНАТЕЛЬ: «исключено проб N из M».
 * /verify/:id и /:id/public фильтра НЕ имеют — прямая ссылка на демо/пробу живёт.
 */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { этоПробаПодписи, ПРОБЫ_ПОДПИСЕЙ_SQL } from "../src/lib/qsignV2/probes";

const СТРОКИ = [
  { id: "live-1", issuerEmail: "ivan@example.com", payloadCanonical: '{"contract":"Договор №12","sum":1000}' },
  { id: "probe-by-mail", issuerEmail: "probe-user-99-qsign-1910-x@aevion.app", payloadCanonical: '{"doc":"demo"}' },
  { id: "live-2", issuerEmail: "anna@example.com", payloadCanonical: '{"latest":"contest results"}' },
  { id: "probe-by-payload", issuerEmail: "someone@example.com", payloadCanonical: '{"idem":"test"}' },
].map((r) => ({ ...r, algoVersion: "qsign-v2.0", hmacKid: "k1", ed25519Kid: "k2", createdAt: new Date().toISOString(), revokedAt: null, geoCountry: "KZ" }));

const sqls: string[] = [];
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      sqls.push(sql);
      // Заглушка нарочно НЕ применяет WHERE: отдаёт все строки, чтобы вторая линия (JS) была видна.
      if (sql.includes('"QSignSignature"') && sql.includes("LIMIT")) return { rows: СТРОКИ, rowCount: СТРОКИ.length };
      return { rows: [], rowCount: 0 };
    }),
  }),
}));
vi.mock("../src/lib/qsignV2/ensureTables", () => ({ ensureQSignV2Tables: vi.fn(async () => {}) }));
vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  getActiveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  getActiveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  resolveHmac: async () => ({ kid: "k1", algo: "HMAC-SHA256", secret: Buffer.alloc(32) }),
  resolveEd25519: async () => ({ kid: "k2", algo: "Ed25519", privateKey: null, publicKeyHex: "" }),
  getKeyByKid: async () => null,
  listKeys: async () => [],
  getActiveKey: async () => null,
}));

const app = async () => {
  const { qsignV2Router } = await import("../src/routes/qsignV2");
  const a = express();
  a.use("/api/qsign/v2", qsignV2Router);
  return a;
};

describe("правило «наша проба» для подписей", () => {
  it("пробы с прода 19.10 — пробы; живые записи — нет (в обе стороны)", () => {
    const пробы = [
      { issuerEmail: "probe-user-99-qsign-1910-mveznzp7@aevion.app", payloadCanonical: '{"doc":"demo","probe":"user-99-qsign-1910"}' },
      { issuerEmail: "demo-qsign@aevion.app", payloadCanonical: '{"document":"AEVION QSign — демонстрационная подпись"}' },
      { issuerEmail: "x@y.z", payloadCanonical: '{"idem":"test"}' },
      { issuerEmail: "x@y.z", payloadCanonical: '{"probe":1}' },
      { issuerEmail: "smoke-1784775240406@aevion.app", payloadCanonical: "{}" },
      // прод-база 19.10: 22 записи домена .test с payload {"hello":"AEVION"} — слова-признаки их не ловили
      { issuerEmail: "qsign-ci@aevion.test", payloadCanonical: '{"alpha":2,"hello":"AEVION","ts":1785133288,"zeta":1}' },
    ];
    const живые = [
      { issuerEmail: "ivan@example.com", payloadCanonical: '{"contract":"Договор №12"}' },
      { issuerEmail: "anna@example.com", payloadCanonical: '{"latest":"contest results","protest":"no"}' },
      { issuerEmail: "demo@example.com", payloadCanonical: '{"a":1}' },
      { issuerEmail: "ivan@testing-lab.com", payloadCanonical: '{"a":1}' }, // .com, не .test
      { issuerEmail: "ivan@contest.kz", payloadCanonical: '{"a":1}' },
    ];
    expect(пробы.filter((р) => !этоПробаПодписи(р)), "пропущенные пробы").toEqual([]);
    expect(живые.filter((р) => этоПробаПодписи(р)), "живые, сочтённые пробами").toEqual([]);
  });
  it("SQL-правило и JS-правило говорят об одних и тех же словах", () => {
    expect(ПРОБЫ_ПОДПИСЕЙ_SQL).toContain("(probe|smoke|demo)[-+._]");
    expect(ПРОБЫ_ПОДПИСЕЙ_SQL).toContain("(probe|smoke|test|idem)");
    expect(ПРОБЫ_ПОДПИСЕЙ_SQL).toContain(String.raw`@[^@]*.test$`);
  });
});

describe("/recent и /stats без проб", () => {
  it("🔴 /recent: из 4 строк наружу 2, probesHidden=2 (знаменатель печатается)", async () => {
    sqls.length = 0;
    const r = await request(await app()).get("/api/qsign/v2/recent?limit=8");
    expect(r.status).toBe(200);
    const ids = (r.body.items as { id: string }[]).map((x) => x.id);
    const сообщение = `исключено проб ${r.body.probesHidden} из ${СТРОКИ.length}`;
    console.log(`[сторож] ${сообщение}`);
    expect(ids, сообщение).toEqual(["live-1", "live-2"]);
    expect(r.body.probesHidden, сообщение).toBe(2);
    expect(r.body.total).toBe(2);
    // наружу не ушли ни почта, ни payload
    expect(JSON.stringify(r.body)).not.toMatch(/issuerEmail|payloadCanonical|example\.com/);
    // и SQL сам фильтрует — вторая линия не единственная
    const sqlRecent = sqls.find((q) => q.includes('"QSignSignature"') && q.includes("LIMIT"))!;
    expect(sqlRecent).toContain(`WHERE NOT ${ПРОБЫ_ПОДПИСЕЙ_SQL}`);
  });
  it("🔴 /stats: все три запроса к QSignSignature несут NOT <правило>", async () => {
    sqls.length = 0;
    const r = await request(await app()).get("/api/qsign/v2/stats");
    expect(r.status).toBe(200);
    const кПодписям = sqls.filter((q) => q.includes('"QSignSignature"'));
    expect(кПодписям.length, `запросов к подписям: ${кПодписям.length}`).toBe(3);
    const безФильтра = кПодписям.filter((q) => !q.includes(`NOT ${ПРОБЫ_ПОДПИСЕЙ_SQL}`));
    expect(безФильтра, `без фильтра ${безФильтра.length} из ${кПодписям.length}`).toEqual([]);
  });
  it("/verify/:id и /:id/public фильтра НЕ имеют — прямая ссылка на демо живёт (по исходнику)", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "qsignV2.ts"), "utf8");
    for (const маршрут of ['qsignV2Router.get("/verify/:id"', 'qsignV2Router.get("/:id/public"']) {
      const от = src.indexOf(маршрут);
      expect(от, маршрут).toBeGreaterThan(0);
      const до = src.indexOf("\nqsignV2Router.", от + 10);
      const блок = src.slice(от, до < 0 ? undefined : до);
      expect(блок, `${маршрут} фильтрует пробы`).not.toContain("ПРОБЫ_ПОДПИСЕЙ_SQL");
    }
  });
});
