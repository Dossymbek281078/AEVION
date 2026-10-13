import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 132б (13.10.2026): гость DevHub после живого адреса оставляет почту через лист ожидания
 * (source devhub-guest + projectId). Сторож ДЕЛАЕТ ЗАПРОС к ручке: письмо на data@ с ссылкой на проект,
 * строка журнала заявок, mailed в ответе; обычный source письма не шлёт (контроль); projectId проверяется схемой.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-waitlist-guest-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");

const { письма, подтверждения } = vi.hoisted(() => ({ письма: [] as Array<{ to: string; subject: string; text: string }>, подтверждения: [] as string[] }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => { throw new Error("нет базы в тесте"); } }) }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return { ok: true, mode: "real" }; } }));
vi.mock("../src/lib/constitutionBrevo", () => ({ sendWaitlistConfirm: async (email: string) => { подтверждения.push(email); return true; }, sendWeeklyDigestEmail: async () => ({ sent: 0 }) }));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

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

describe("POST /api/constitution/waitlist/subscribe — гость DevHub", () => {
  it("🔴 source devhub-guest + projectId → 201, письмо на data@ со ссылкой на проект, строка журнала, mailed:true", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "Guest@Example.com", source: "devhub-guest", projectId: "3b67f331-c78e-4a5f-9cc8-b140b793766a", channel: "yt-devhub-1" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ ok: true, mailed: true });
    expect(письма).toHaveLength(1);
    expect(письма[0].to).toBe("data@aevion.app");
    expect(письма[0].subject).toContain("guest@example.com");
    expect(письма[0].text).toContain("https://aevion.app/devhub/3b67f331-c78e-4a5f-9cc8-b140b793766a");
    expect(письма[0].text).toContain("channel: yt-devhub-1");
    expect(журнал().map((z) => [z.kind, z.projectId, z.source, z.channel])).toEqual([["devhub_save_email", "3b67f331-c78e-4a5f-9cc8-b140b793766a", "devhub-guest", "yt-devhub-1"]]);
    expect(подтверждения).toEqual(["guest@example.com"]);
  });

  it("контроль: обычный source письма на data@ не шлёт и mailed не отдаёт", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "kto@primer.ru", source: "footer:/devhub" });
    expect(r.status).toBe(201);
    expect(r.body.mailed).toBeUndefined();
    expect(письма).toHaveLength(0);
    expect(журнал()).toEqual([]);
  });

  it("projectId с недопустимыми знаками — 400 схемой, без письма", async () => {
    const r = await request(await приложение()).post("/api/constitution/waitlist/subscribe").send({ email: "kto@primer.ru", source: "devhub-guest", projectId: "../etc; drop" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("validation_failed");
    expect(письма).toHaveLength(0);
  });
});
