import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 132б+135 (13.10.2026): гость DevHub после живого адреса оставляет почту через лист ожидания
 * (source devhub-guest + projectId). Сторож ДЕЛАЕТ ЗАПРОС к ручке: письмо на data@ (ссылка на проект,
 * адреса, канал), письмо ГОСТЮ тем же путём (Resend) на его языке с обоими адресами — без Brevo
 * (оно уходило в спам и по-русски); обычный source: Brevo как раньше, писем Resend нет; схема
 * отбрасывает чужие projectId/siteUrl/domain.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-waitlist-guest-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");

const { письма, подтверждения } = vi.hoisted(() => ({ письма: [] as Array<{ to: string; subject: string; text: string }>, подтверждения: [] as string[] }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => { throw new Error("нет базы в тесте"); } }) }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return { ok: true, mode: "real" }; } }));
vi.mock("../src/lib/constitutionBrevo", () => ({ sendWaitlistConfirm: async (email: string) => { подтверждения.push(email); return true; }, sendWeeklyDigestEmail: async () => ({ sent: 0 }) }));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;
async function приложение() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const app = express();
  app.use(express.json());
  app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return app;
}
const журнал = () => (existsSync(process.env.LEADS_FILE!) ? readFileSync(process.env.LEADS_FILE!, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) : []);
beforeEach(() => { письма.length = 0; подтверждения.length = 0; if (existsSync(process.env.LEADS_FILE!)) rmSync(process.env.LEADS_FILE!); });
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

const ГОСТЬ = { email: "Guest@Example.com", source: "devhub-guest", projectId: "3b67f331-c78e-4a5f-9cc8-b140b793766a", channel: "yt-devhub-1", lang: "en", siteUrl: "https://aevion-coffee-3b67f3.pages.dev", domain: "coffee-3b67f3.aevion.app" };

describe("POST /api/constitution/waitlist/subscribe — гость DevHub", () => {
  it("🔴 devhub-guest → 201, письмо на data@ (проект, адреса, канал) и письмо гостю по-английски с обоими адресами; Brevo не зовётся", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send(ГОСТЬ);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ ok: true, mailed: true, guestMailed: true });
    expect(письма.map((p) => p.to)).toEqual(["data@aevion.app", "guest@example.com"]);
    const нам = письма[0], гостю = письма[1];
    expect(нам.subject).toContain("guest@example.com");
    expect(нам.text).toContain("https://aevion.app/devhub/3b67f331-c78e-4a5f-9cc8-b140b793766a");
    expect(нам.text).toContain("channel: yt-devhub-1");
    expect(нам.text).toContain("https://aevion-coffee-3b67f3.pages.dev");
    expect(нам.text).toContain("https://coffee-3b67f3.aevion.app");
    expect(КИРИЛЛИЦА.test(гостю.subject), гостю.subject).toBe(false);
    expect(КИРИЛЛИЦА.test(гостю.text), гостю.text).toBe(false);
    expect(гостю.text).toContain("https://aevion-coffee-3b67f3.pages.dev");
    expect(гостю.text).toContain("https://coffee-3b67f3.aevion.app");
    expect(гостю.text).toContain("within a day");
    expect(гостю.text).not.toMatch(/minute/i);
    expect(подтверждения).toEqual([]);
    expect(журнал().map((z) => [z.kind, z.projectId, z.channel, z.lang, z.guestMailed])).toEqual([["devhub_save_email", "3b67f331-c78e-4a5f-9cc8-b140b793766a", "yt-devhub-1", "en", true]]);
  });

  it("язык гостя ru и kk — тема и тело на его языке, адреса те же", async () => {
    for (const [lang, слово] of [["ru", "Ваш сайт"], ["kk", "Сайтыңыз"]] as const) {
      письма.length = 0;
      const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, email: `g-${lang}@example.com`, lang });
      expect(r.status).toBe(201);
      expect(письма[1].subject.includes(слово) || письма[1].text.includes(слово), `${lang}: ${письма[1].subject}`).toBe(true);
      expect(письма[1].text).toContain("https://coffee-3b67f3.aevion.app");
    }
  });

  it("без домена и адреса письмо гостю всё равно уходит, без пустых строк «https://null»", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "g2@example.com", source: "devhub-guest", lang: "en" });
    expect(r.status).toBe(201);
    expect(письма).toHaveLength(2);
    expect(письма[1].text).not.toMatch(/null|undefined/);
  });

  it("контроль: обычный source — Brevo как раньше, писем Resend нет, mailed не отдаётся", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "kto@primer.ru", source: "footer:/devhub" });
    expect(r.status).toBe(201);
    expect(r.body.mailed).toBeUndefined();
    expect(письма).toHaveLength(0);
    expect(подтверждения).toEqual(["kto@primer.ru"]);
    expect(журнал()).toEqual([]);
  });

  it("схема: чужие projectId / siteUrl / domain — 400, без писем", async () => {
    for (const плохое of [{ projectId: "../etc; drop" }, { siteUrl: "https://evil.example/x" }, { domain: "evil.example" }, { lang: "de" }]) {
      письма.length = 0;
      const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, ...плохое });
      expect(r.status, JSON.stringify(плохое)).toBe(400);
      expect(r.body.error).toBe("validation_failed");
      expect(письма).toHaveLength(0);
    }
  });
});
