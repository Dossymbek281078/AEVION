import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";

// Хранилище подписок читается из файла, путь берётся из env на импорте модуля,
// поэтому каталог готовим ДО подключения роутера.
const dir = mkdtempSync(join(tmpdir(), "aevion-prov-"));
const SUBS = join(dir, "subscriptions.jsonl");
const SECRET = "test-secret-for-provisioning";

process.env.SUBSCRIPTIONS_FILE = SUBS;
process.env.DASHBOARD_SECRET = SECRET;

const sendEmail = vi.fn(async () => ({ ok: true }));
vi.mock("../src/routes/provisioning", async () => {
  const actual = await vi.importActual<typeof import("../src/routes/provisioning")>(
    "../src/routes/provisioning",
  );
  return { ...actual, sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) };
});

const { pricingRouter } = await import("../src/routes/pricing");

const app = express();
app.use(express.json());
app.use("/api/pricing", pricingRouter);

const MINE = "buyer@example.com";
const OTHER = "someone-else@example.com";

function tokenFor(email: string, scope: string) {
  return createHmac("sha256", SECRET).update(`${email.toLowerCase()}:${scope}`).digest("hex").slice(0, 32);
}

function sub(over: Record<string, unknown>) {
  return JSON.stringify({
    id: "s1", ts: "2026-08-01T10:00:00.000Z", email: MINE, tierId: "full",
    period: "monthly", seats: 1, modules: ["qsign"], trialDays: 0, ...over,
  });
}

beforeAll(() => {
  writeFileSync(
    SUBS,
    [
      sub({ id: "s-old", ts: "2026-07-01T10:00:00.000Z", validUntil: "2026-07-15T00:00:00.000Z" }),
      sub({ id: "s-trial", ts: "2026-08-05T10:00:00.000Z", trialDays: 14, validUntil: "2099-01-01T00:00:00.000Z" }),
      sub({ id: "s-open", ts: "2026-08-09T10:00:00.000Z", amountUsd: 49, stripeSessionId: "cs_secret_123" }),
      sub({ id: "s-other", email: OTHER }),
    ].join("\n") + "\n",
    "utf8",
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => sendEmail.mockClear());

// Ограничитель считает 3 запроса на IP за 10 минут — общий для всех тестов.
// Свой адрес на каждый вызов проверяет ручку, а не ограничитель.
let ipN = 0;
function nextIp() {
  ipN += 1;
  return `203.0.113.${ipN}`;
}

describe("GET /api/pricing/provisioning/history", () => {
  it("без токена не отдаёт ничего — знать адрес недостаточно", async () => {
    const r = await request(app).get("/api/pricing/provisioning/history").query({ email: MINE });
    expect(r.status).toBe(401);
    expect(JSON.stringify(r.body)).not.toContain("s-open");
  });

  it("токен от другой области не подходит", async () => {
    // Ссылка на партнёрский дашборд не должна открывать историю покупок.
    const r = await request(app)
      .get("/api/pricing/provisioning/history")
      .query({ email: MINE, token: tokenFor(MINE, "partners") });
    expect(r.status).toBe(401);
  });

  it("чужой токен не открывает чужую историю", async () => {
    const r = await request(app)
      .get("/api/pricing/provisioning/history")
      .query({ email: MINE, token: tokenFor(OTHER, "provisioning") });
    expect(r.status).toBe(401);
  });

  it("со своим токеном отдаёт только свои записи, свежие сверху", async () => {
    const r = await request(app)
      .get("/api/pricing/provisioning/history")
      .query({ email: MINE, token: tokenFor(MINE, "provisioning") });

    expect(r.status).toBe(200);
    expect(r.body.count).toBe(3);
    expect(r.body.truncated).toBe(false);
    expect(r.body.items.map((i: { id: string }) => i.id)).toEqual(["s-open", "s-trial", "s-old"]);
  });

  it("статус считается по сроку, а бессрочная покупка не «истекла»", async () => {
    const r = await request(app)
      .get("/api/pricing/provisioning/history")
      .query({ email: MINE, token: tokenFor(MINE, "provisioning") });
    const byId = Object.fromEntries(
      r.body.items.map((i: { id: string; status: string; daysLeft: number | null }) => [i.id, i]),
    );
    expect(byId["s-old"].status).toBe("expired");
    expect(byId["s-trial"].status).toBe("trial");
    expect(byId["s-open"].status).toBe("active");
    expect(byId["s-open"].daysLeft).toBeNull();
  });

  it("адрес замаскирован, а сессия Stripe наружу не уходит", async () => {
    const r = await request(app)
      .get("/api/pricing/provisioning/history")
      .query({ email: MINE, token: tokenFor(MINE, "provisioning") });

    const raw = JSON.stringify(r.body);
    expect(raw).not.toContain(MINE);
    expect(raw).not.toContain("cs_secret_123");
    expect(r.body.email).toBe("b****@example.com");
  });
});

describe("POST /api/pricing/provisioning/magic-link", () => {
  it("отвечает одинаково и покупателю, и незнакомцу", async () => {
    const known = await request(app)
      .post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: MINE });
    const unknown = await request(app)
      .post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: "nobody@example.com" });

    // Разные коды или тела позволили бы перебором узнать, кто покупал.
    expect(known.status).toBe(204);
    expect(unknown.status).toBe(204);
    expect(known.text).toBe(unknown.text);
  });

  it("письмо уходит только тому, у кого подписки есть", async () => {
    await request(app).post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: "nobody@example.com" });
    expect(sendEmail).not.toHaveBeenCalled();

    await request(app).post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: MINE });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("в ссылке из письма — рабочий токен именно этой области", async () => {
    await request(app).post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: MINE });
    const sent = sendEmail.mock.calls[0][0] as unknown as { text: string };
    const token = /token=([a-f0-9]+)/.exec(sent.text)?.[1];

    expect(token).toBe(tokenFor(MINE, "provisioning"));

    const r = await request(app)
      .get("/api/pricing/provisioning/history").query({ email: MINE, token });
    expect(r.status).toBe(200);
  });

  it("кривой адрес отбивается до всякой работы", async () => {
    const r = await request(app).post("/api/pricing/provisioning/magic-link").set("X-Forwarded-For", nextIp()).send({ email: "не-почта" });
    expect(r.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
