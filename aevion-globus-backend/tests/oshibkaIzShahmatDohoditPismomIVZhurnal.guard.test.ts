import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 143 (18.10.2026): «Нашли ошибку?» — отчёт идёт событием feature_use (meta.feature="oshibka") через
 * POST /api/pricing/events. Сторож ДЕЛАЕТ ЗАПРОС к ручке и проверяет: (1) полный текст (до 2000) и авто-поля
 * уходят письмом на data@ и строкой kind "cyberchess_oshibka" в журнал заявок; в журнале событий остаётся событие
 * (там meta.text режется до 200 — это норма журнала); (2) пустой текст — 400 empty_text, > 2000 — 400, плохая
 * почта — 400, и ничего не пишется; (3) отказ почты не ломает ответ (204) и даёт строку "undelivered";
 * (4) исход проверки доставки ≠ delivered — строка "undelivered", не тишина.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-oshibka-"));
process.env.EVENTS_FILE = join(каталог, "events.jsonl");
process.env.LEADS_FILE = join(каталог, "leads.jsonl");

const { почта, проверки } = vi.hoisted(() => ({ почта: { письма: [] as Array<{ to: string; subject: string; text: string }>, падать: false }, проверки: [] as Array<{ id?: string; naItog?: (x: { lastEvent: string | null; повтор: boolean; brevoOk?: boolean }) => void }> }));
vi.mock("../src/routes/provisioning", () => ({ sendEmail: async (p: { to: string; subject: string; text: string }) => { if (почта.падать) return { ok: false, mode: "real", error: "resend 500" }; почта.письма.push(p); return { ok: true, mode: "real", id: "re_" + почта.письма.length }; } }));
vi.mock("../src/lib/resendDostavka", () => ({ zaplanirovatProverkuDostavki: (a: { id?: string; naItog?: (x: { lastEvent: string | null; повтор: boolean; brevoOk?: boolean }) => void }) => { проверки.push(a); return true; } }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api/pricing/events", eventsRouter);
  return app;
}
const заявки = () => (existsSync(process.env.LEADS_FILE!) ? readFileSync(process.env.LEADS_FILE!, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : []);
const события = () => (existsSync(process.env.EVENTS_FILE!) ? readFileSync(process.env.EVENTS_FILE!, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : []);
const ждать = (ms = 50) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { почта.письма.length = 0; почта.падать = false; проверки.length = 0; for (const f of [process.env.EVENTS_FILE!, process.env.LEADS_FILE!]) if (existsSync(f)) rmSync(f); });
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

const текст = "После хода конём доска перестала отвечать, кнопка «Подсказка» не нажимается. ".repeat(4).trim(); // > 200, < 2000
const отчёт = (over: Record<string, unknown> = {}) => ({
  type: "feature_use", source: "cyberchess/board", sid: "s_test_oshibka", path: "/cyberchess/p/li_075iw?c=x-chess-1&probe=user-99",
  meta: { feature: "oshibka", app: "cyberchess", kontekst: "puzzle", text: текст, email: "igrok@example.com", tester: true, fen: "5r1k/p5pp/2p1Q3/1pq1p3/4P3/8/B4PPP/5RK1 w - - 0 32", puzzleId: "li_075iw", viewport: "390x844", ...over },
});

describe("«Нашли ошибку?» — письмо и журнал (143)", () => {
  it("🔴 отчёт → 204; письмо на data@ с полным текстом и авто-полями; строка cyberchess_oshibka в заявках; событие в журнале", async () => {
    const r = await request(await приложение()).post("/api/pricing/events").set("User-Agent", "Mozilla/5.0 (Linux; Android 14) Chrome/153 Mobile").send(отчёт());
    expect(r.status, JSON.stringify(r.body)).toBe(204);
    await ждать();
    expect(почта.письма).toHaveLength(1);
    const п = почта.письма[0];
    expect(п.to).toBe("data@aevion.app");
    expect(п.subject).toMatch(/^CyberChess · ошибка от игрока: /);
    expect(п.text).toContain(текст);
    for (const кусок of ["igrok@example.com", "li_075iw", "5r1k/p5pp/2p1Q3", "390x844", "x-chess-1", "Android 14", "тестировщики: да"]) expect(п.text, кусок).toContain(кусок);
    expect(проверки).toEqual([expect.objectContaining({ id: "re_1" })]);
    const з = заявки();
    expect(з.map((x) => x.kind)).toEqual(["cyberchess_oshibka"]);
    expect(з[0].text).toBe(текст);
    expect(z0(з).puzzleId).toBe("li_075iw");
    const с = события();
    expect(с).toHaveLength(1);
    expect((с[0].meta as Record<string, unknown>).feature).toBe("oshibka");
    expect(String((с[0].meta as Record<string, unknown>).text).length).toBeLessThanOrEqual(200); // журнал событий режет, и это норма: полный текст — в письме и заявках
  });

  it("🔴 пустой текст — 400 empty_text, > 2000 — 400, плохая почта — 400; ни письма, ни строк", async () => {
    const app = await приложение();
    const п1 = await request(app).post("/api/pricing/events").send(отчёт({ text: " " }));
    expect(п1.status).toBe(400); expect(п1.body).toEqual({ error: "empty_text" });
    const п2 = await request(app).post("/api/pricing/events").send(отчёт({ text: "я".repeat(2001) }));
    expect(п2.status).toBe(400); expect(п2.body).toEqual({ error: "text_too_long" });
    const п3 = await request(app).post("/api/pricing/events").send(отчёт({ email: "не почта" }));
    expect(п3.status).toBe(400); expect(п3.body).toEqual({ error: "bad_email" });
    await ждать();
    expect(почта.письма).toHaveLength(0);
    expect(заявки()).toHaveLength(0);
    expect(события()).toHaveLength(0);
  });

  it("КОНТРОЛЬ: обычный отзыв (feature otzyv) письма не шлёт и в заявки не пишет — путь 16.10 не тронут", async () => {
    const r = await request(await приложение()).post("/api/pricing/events").send({ type: "feature_use", source: "cyberchess/board", sid: "s_otzyv", path: "/cyberchess", meta: { feature: "otzyv", app: "cyberchess", kontekst: "puzzle", text: "класс" } });
    expect(r.status).toBe(204);
    await ждать();
    expect(почта.письма).toHaveLength(0);
    expect(заявки()).toHaveLength(0);
    expect(события()).toHaveLength(1);
  });

  it("🔴 отказ почты: ответ всё равно 204, в заявках строка cyberchess_oshibka и строка undelivered со стадией send", async () => {
    почта.падать = true;
    const r = await request(await приложение()).post("/api/pricing/events").send(отчёт());
    expect(r.status).toBe(204);
    await ждать();
    expect(заявки().map((x) => [x.kind, x.stage ?? null])).toEqual([["cyberchess_oshibka", null], ["cyberchess_oshibka_undelivered", "send"]]);
  });

  it("🔴 исход проверки доставки ≠ delivered → строка undelivered со стадией delivery; delivered → ничего", async () => {
    const app = await приложение();
    await request(app).post("/api/pricing/events").send(отчёт());
    await ждать();
    expect(проверки).toHaveLength(1);
    проверки[0].naItog!({ lastEvent: "delivered", повтор: false });
    expect(заявки().filter((x) => x.kind === "cyberchess_oshibka_undelivered")).toHaveLength(0);
    проверки[0].naItog!({ lastEvent: "bounced", повтор: true, brevoOk: false });
    const нед = заявки().filter((x) => x.kind === "cyberchess_oshibka_undelivered");
    expect(нед).toHaveLength(1);
    expect(нед[0]).toMatchObject({ stage: "delivery", lastEvent: "bounced", resendId: "re_1" });
  });
});
function z0(з: Array<Record<string, unknown>>): Record<string, unknown> { return з[0]; }
