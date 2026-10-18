import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 132б+135+135б (13–14.10.2026): гость DevHub после живого адреса оставляет почту через лист ожидания
 * (source devhub-guest + projectId). Сторож ДЕЛАЕТ ЗАПРОС к ручке: письмо ГОСТЮ первым (Resend, его язык,
 * оба адреса, имя сайта в теме), уведомление нам вторым — на ящик из DEVHUB_GUEST_NOTIFY_TO; проверка
 * доставки планируется для обоих (мок); Brevo гостю не зовётся; обычный source — как раньше; схема
 * отбрасывает чужие projectId/siteUrl/domain; выгрузка /guest-leads — только админу, за N часов.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-waitlist-guest-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");
process.env.DEVHUB_GUEST_NOTIFY_TO = "founder-inbox@example.com";

const { письма, подтверждения, проверки, адм } = vi.hoisted(() => ({ письма: [] as Array<{ to: string; subject: string; text: string }>, подтверждения: [] as string[], проверки: [] as Array<{ id?: string; to: string }>, адм: { ok: false } }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => { throw new Error("нет базы в тесте"); } }) }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return { ok: true, mode: "real", id: "re_" + письма.length }; } }));
vi.mock("../src/lib/constitutionBrevo", () => ({ sendWaitlistConfirm: async (email: string) => { подтверждения.push(email); return true; }, sendWeeklyDigestEmail: async () => ({ sent: 0 }), sendBrevoEmail: async () => ({ ok: true }) }));
vi.mock("../src/lib/resendDostavka", () => ({ zaplanirovatProverkuDostavki: (a: { id?: string; pismo: { to: string } }) => { проверки.push({ id: a.id, to: a.pismo.to }); return true; } }));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/adminAuth", () => ({ isAdminRequest: () => адм.ok }));

const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;
async function приложение() {
  const { constitutionWaitlistRouter, constitutionWaitlistAdminRouter } = await import("../src/routes/constitutionWaitlist");
  const app = express();
  app.use(express.json());
  app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  app.use("/api/admin/constitution/waitlist", constitutionWaitlistAdminRouter);
  return app;
}
const журнал = () => (existsSync(process.env.LEADS_FILE!) ? readFileSync(process.env.LEADS_FILE!, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) : []);
beforeEach(() => { письма.length = 0; подтверждения.length = 0; проверки.length = 0; адм.ok = false; if (existsSync(process.env.LEADS_FILE!)) rmSync(process.env.LEADS_FILE!); });
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

const ГОСТЬ = { email: "Guest@Example.com", source: "devhub-guest", projectId: "3b67f331-c78e-4a5f-9cc8-b140b793766a", channel: "yt-devhub-1", lang: "en", siteUrl: "https://aevion-coffee-3b67f3.pages.dev", domain: "coffee-3b67f3.aevion.app" };

describe("POST /api/constitution/waitlist/subscribe — гость DevHub", () => {
  it("🔴 devhub-guest → гостю ПЕРВЫМ (en, оба адреса, имя сайта в теме), нам вторым на DEVHUB_GUEST_NOTIFY_TO; обе доставки под проверкой; Brevo не зовётся", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send(ГОСТЬ);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ ok: true, mailed: true, guestMailed: true });
    expect(письма.map((p) => p.to)).toEqual(["guest@example.com", "founder-inbox@example.com"]);
    const гостю = письма[0], нам = письма[1];
    expect(гостю.subject).toBe("Your site on AEVION DevHub: link and address — coffee-3b67f3");
    expect(КИРИЛЛИЦА.test(гостю.subject + гостю.text)).toBe(false);
    expect(гостю.text).toContain("https://aevion-coffee-3b67f3.pages.dev");
    expect(гостю.text).toContain("https://coffee-3b67f3.aevion.app");
    expect(гостю.text).toContain("within a day");
    expect(гостю.text).not.toMatch(/minute/i);
    expect(нам.subject).toContain("guest@example.com");
    expect(нам.text).toContain("https://aevion.app/devhub/3b67f331-c78e-4a5f-9cc8-b140b793766a");
    expect(нам.text).toContain("channel: yt-devhub-1");
    expect(проверки).toEqual([{ id: "re_1", to: "guest@example.com" }, { id: "re_2", to: "founder-inbox@example.com" }]);
    expect(подтверждения).toEqual([]);
    expect(журнал().map((z) => [z.kind, z.projectId, z.channel, z.lang, z.guestMailed])).toEqual([["devhub_save_email", "3b67f331-c78e-4a5f-9cc8-b140b793766a", "yt-devhub-1", "en", true]]);
  });

  it("имя сайта в теме — из домена, иначе из адреса pages.dev, иначе без хвоста", async () => {
    const app = await приложение();
    await request(app).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, domain: undefined });
    expect(письма[0].subject).toBe("Your site on AEVION DevHub: link and address — coffee-3b67f3");
    письма.length = 0;
    await request(app).post("/api/constitution/waitlist/subscribe").send({ email: "g2@example.com", source: "devhub-guest", lang: "en" });
    expect(письма[0].subject).toBe("Your site on AEVION DevHub: link and address");
    expect(письма[0].text).not.toMatch(/null|undefined/);
  });

  it("язык гостя ru и kk — тема и тело на его языке", async () => {
    for (const [lang, слово] of [["ru", "Ваш сайт"], ["kk", "Сайтыңыз"]] as const) {
      письма.length = 0;
      const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, email: `g-${lang}@example.com`, lang });
      expect(r.status).toBe(201);
      expect(письма[0].subject.includes(слово) || письма[0].text.includes(слово), `${lang}: ${письма[0].subject}`).toBe(true);
    }
  });

  it("контроль: обычный source — Brevo как раньше, писем Resend нет, mailed не отдаётся", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "kto@primer.ru", source: "footer:/devhub" });
    expect(r.status).toBe(201);
    expect(r.body.mailed).toBeUndefined();
    expect(письма).toHaveLength(0);
    expect(подтверждения).toEqual(["kto@primer.ru"]);
  });

  it("схема: чужие projectId / siteUrl / domain / lang — 400, без писем", async () => {
    for (const плохое of [{ projectId: "../etc; drop" }, { siteUrl: "https://evil.example/x" }, { domain: "evil.example" }, { lang: "de" }]) {
      письма.length = 0;
      const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ ...ГОСТЬ, ...плохое });
      expect(r.status, JSON.stringify(плохое)).toBe(400);
      expect(письма).toHaveLength(0);
    }
  });
});

describe("GET /api/admin/constitution/waitlist/guest-leads — выгрузка для Почты", () => {
  it("🔴 только админ; отдаёт заявки devhub_*/pilot_* за N часов из журнала", async () => {
    const сейчас = Date.now();
    writeFileSync(process.env.LEADS_FILE!, [
      JSON.stringify({ ts: new Date(сейчас - 3600_000).toISOString(), kind: "devhub_save_email", email: "a@x.io", projectId: "p1", guestMailed: true }),
      JSON.stringify({ ts: new Date(сейчас - 30 * 3600_000).toISOString(), kind: "devhub_save_email", email: "old@x.io" }),
      JSON.stringify({ ts: new Date(сейчас - 600_000).toISOString(), kind: "pilot_490", email: "b@x.io" }),
      JSON.stringify({ ts: new Date(сейчас - 600_000).toISOString(), kind: "other_kind", email: "c@x.io" }),
      JSON.stringify({ ts: new Date(сейчас - 300_000).toISOString(), kind: "cyberchess_oshibka_undelivered", stage: "delivery", lastEvent: "bounced" }),
    ].join("\n") + "\n");
    const app = await приложение();
    expect((await request(app).get("/api/admin/constitution/waitlist/guest-leads?hours=24")).status).toBe(403);
    адм.ok = true;
    const r = await request(app).get("/api/admin/constitution/waitlist/guest-leads?hours=24");
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(3); // 143: отчёты об ошибке и их недоставка тоже в выгрузке
    expect(r.body.items.map((x: { kind: string }) => x.kind).sort()).toEqual(["cyberchess_oshibka_undelivered", "devhub_save_email", "pilot_490"]);
    const r2 = await request(app).get("/api/admin/constitution/waitlist/guest-leads?hours=48");
    expect(r2.body.count).toBe(4);
  });
});
