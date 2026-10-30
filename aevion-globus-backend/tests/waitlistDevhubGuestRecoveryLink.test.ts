import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * Ссылка восстановления в письме гостю DevHub: https://aevion.app/devhub/<projectId>?k=<guestKey>.
 * Гость из чистого браузера открывает свой проект. Мусорный ключ — 201 без ссылки; в журнале заявок
 * ключ только началом (6 знаков + «…»).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-waitlist-recovery-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");
process.env.DEVHUB_GUEST_NOTIFY_TO = "founder-inbox@example.com";

const { письма } = vi.hoisted(() => ({ письма: [] as Array<{ to: string; subject: string; text: string }> }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => { throw new Error("нет базы в тесте"); } }) }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return { ok: true, mode: "real", id: "re_" + письма.length }; } }));
vi.mock("../src/lib/constitutionBrevo", () => ({ sendWaitlistConfirm: async () => true, sendWeeklyDigestEmail: async () => ({ sent: 0 }), sendBrevoEmail: async () => ({ ok: true }) }));
vi.mock("../src/lib/resendDostavka", () => ({ zaplanirovatProverkuDostavki: () => true }));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/adminAuth", () => ({ isAdminRequest: () => false }));

async function приложение() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const app = express();
  app.use(express.json());
  app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return app;
}
const журнал = () => (existsSync(process.env.LEADS_FILE!) ? readFileSync(process.env.LEADS_FILE!, "utf8") : "");
beforeEach(() => { письма.length = 0; if (existsSync(process.env.LEADS_FILE!)) rmSync(process.env.LEADS_FILE!); });
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

const PID = "3b67f331-c78e-4a5f-9cc8-b140b793766a";
const KEY = "0f8e7d6c-1234-4abc-9def-aaaaaaaaaaaa";
const ГОСТЬ = { email: "guest@example.com", source: "devhub-guest", projectId: PID, lang: "en", siteUrl: "https://aevion-coffee-3b67f3.pages.dev", domain: "coffee-3b67f3.aevion.app" };

describe("письмо гостю DevHub — ссылка восстановления", () => {
  it("с guestKey: ссылка /devhub/<id>?k=<ключ> и подпись, только в письме гостю", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, guestKey: KEY });
    expect(r.status).toBe(201);
    expect(письма[0].to).toBe("guest@example.com");
    expect(письма[0].text).toContain(`https://aevion.app/devhub/${PID}?k=${KEY}`);
    expect(письма[0].text).toContain("do not forward it");
    expect(письма[1].text).not.toContain(KEY);
  });

  it.each([["ru", "не пересылайте"], ["kk", "жібермеңіз"]])("язык %s: ссылка и подпись на языке письма", async (lang, слово) => {
    await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, lang, guestKey: KEY });
    expect(письма[0].text).toContain(`?k=${KEY}`);
    expect(письма[0].text).toContain(слово);
  });

  it("без guestKey: ссылки с ?k= нет", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send(ГОСТЬ);
    expect(r.status).toBe(201);
    expect(письма[0].text).not.toContain("?k=");
  });

  it.each(["short", "has space in it!", "x".repeat(65), "кириллица-ключ-1234", "a/../b/../c1234"])("мусорный guestKey %j → 201 без ссылки", async (мусор) => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, guestKey: мусор });
    expect(r.status).toBe(201);
    expect(письма[0].text).not.toContain("?k=");
  });

  it("в журнале заявок ключа целиком нет — только 6 знаков и «…»", async () => {
    await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, guestKey: KEY });
    const ж = журнал();
    expect(ж).not.toContain(KEY);
    expect(JSON.parse(ж.trim()).guestKey).toBe("0f8e7d…");
  });
});
