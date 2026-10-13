import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 Заказ пилота $490 с /proof: ручка пишет заявку (таблица + leads.jsonl), шлёт письмо
 * на data@aevion.app и автоответ покупателю, честно называет отказы в теле ответа.
 * Сторож делает настоящий POST к ручке и читает тело (0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-pilot-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");

const { запросы, письма, почтаОк } = vi.hoisted(() => ({ запросы: [] as Array<{ sql: string; params: unknown[] }>, письма: [] as Array<{ to: string; subject: string; text: string }>, почтаОк: { v: true } }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async (sql: string, params: unknown[] = []) => { запросы.push({ sql, params }); return { rows: [], rowCount: 1 }; } }) }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return почтаОк.v ? { ok: true, mode: "real", id: "m-" + письма.length } : { ok: false, mode: "real", error: "resend 500" }; } }));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));

async function приложение() {
  const { proofPilotRouter } = await import("../src/routes/proofPilot");
  const app = express();
  app.use(express.json());
  app.use("/api/proof", proofPilotRouter);
  return app;
}

beforeEach(() => { запросы.length = 0; письма.length = 0; почтаОк.v = true; if (existsSync(process.env.LEADS_FILE!)) rmSync(process.env.LEADS_FILE!); });

describe("POST /api/proof/pilot-order", () => {
  it("🔴 заявка: 201, запись в таблицу и журнал, письмо нам и автоответ покупателю — с условиями страницы", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-order").send({ email: "Buyer@Example.com", records: "25,000", days: 7, data: "product catalogue, 25k rows", channel: "mail-outreach", post: "ai25", path: "/proof?c=mail-ai25" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.ok).toBe(true);
    expect(r.body.stored).toBe(true);
    expect(r.body.journaled).toBe(true);
    expect(r.body.mailed).toEqual({ us: true, buyer: true, mode: "real" });
    expect(r.body.errors).toEqual([]);
    const вставка = запросы.find((q) => /INSERT INTO proof_pilot_order/.test(q.sql));
    expect(вставка?.params.slice(1, 4)).toEqual(["buyer@example.com", 25000, 7]);
    const строки = readFileSync(process.env.LEADS_FILE!, "utf8").trim().split("\n");
    expect(строки.length).toBe(1);
    expect(JSON.parse(строки[0])).toMatchObject({ kind: "pilot_490", email: "buyer@example.com", records: 25000, channel: "mail-outreach", post: "ai25" });
    expect(письма.map((p) => p.to)).toEqual(["data@aevion.app", "buyer@example.com"]);
    expect(письма[0].subject).toContain("$490");
    expect(письма[0].text).toContain("25,000");
    expect(письма[1].text).toMatch(/invoice comes after|send the invoice/);
    expect(письма[1].text).toContain("Nothing has been charged");
    expect(письма[1].text).toContain("verify kit");
  });

  it("honeypot заполнен — 200 ok для робота, но ничего не записано и не отправлено", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-order").send({ email: "bot@example.com", website: "http://spam" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, stored: false, honeypot: true });
    expect(запросы.some((q) => /INSERT/.test(q.sql))).toBe(false);
    expect(письма.length).toBe(0);
    expect(existsSync(process.env.LEADS_FILE!)).toBe(false);
  });

  it("плохая почта — 400 с кодом", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-order").send({ email: "not-an-email" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("valid_email_required");
  });

  it("🔴 отказ почты не молчит: 201 (заявка записана), mailed.us=false и причина в errors", async () => {
    почтаОк.v = false;
    const r = await request(await приложение()).post("/api/proof/pilot-order").send({ email: "x@example.org" });
    expect(r.status).toBe(201);
    expect(r.body.mailed.us).toBe(false);
    expect(r.body.errors.join(" ")).toContain("mail-us: resend 500");
    expect(r.body.errors.join(" ")).toContain("mail-buyer");
  });

  it("умолчания: records 10 000, days 7; границы режутся", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-order").send({ email: "y@example.org", records: 99_999_999, days: 0 });
    const вставка = запросы.find((q) => /INSERT INTO proof_pilot_order/.test(q.sql));
    expect(вставка?.params.slice(2, 4)).toEqual([1_000_000, 1]);
    expect(r.status).toBe(201);
  });
});
