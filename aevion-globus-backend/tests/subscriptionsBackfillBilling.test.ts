/*
 * 21.10.2026: разовая дозапись режима оплаты в старые строки LemonSqueezy.
 * dryRun по умолчанию НЕ меняет файл ни на байт; запись — только dryRun:false
 * под ADMIN_TOKEN. Режим выводится из пары (ступень, списанная сумма).
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import express from "express";

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
const FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "backfill-billing-")), "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = FILE;
process.env.ADMIN_TOKEN = "adm-test";

// eslint-disable-next-line import/first
import { provisioningRouter } from "../src/routes/provisioning";

const base = { email: "x@test.aev", seats: 1, modules: [], trialDays: 0 };
const ИСХОД = [
  { ...base, id: "m1", ts: "2026-10-19T10:00:00.000Z", tierId: "medium", termMonths: 3, amountUsd: 225, source: "lemonsqueezy", providerPaymentId: "ls1" },
  { ...base, id: "m2", ts: "2026-10-20T10:00:00.000Z", tierId: "medium", termMonths: 3, amountUsd: 225, source: "lemonsqueezy", providerPaymentId: "ls1" },
  { ...base, id: "p1", ts: "2026-10-19T12:00:00.000Z", tierId: "max", termMonths: 12, amountUsd: 1575, source: "lemonsqueezy", providerPaymentId: "ls2" },
  { ...base, id: "done", ts: "2026-10-21T09:00:00.000Z", tierId: "max", termMonths: 12, amountUsd: 150, source: "lemonsqueezy", providerPaymentId: "ls3", billing: "monthly", commitStartedAt: "2026-10-21T09:00:00.000Z" },
  { ...base, id: "old", ts: "2026-10-10T10:00:00.000Z", tierId: "lite", termMonths: 1, amountUsd: 250, source: "lemonsqueezy", providerPaymentId: "ls4" },
  { ...base, id: "odd", ts: "2026-10-19T15:00:00.000Z", tierId: "medium", termMonths: 3, amountUsd: 999, source: "lemonsqueezy", providerPaymentId: "ls5" },
  { ...base, id: "gum", ts: "2026-10-19T16:00:00.000Z", tierId: "max", termMonths: 12, amountUsd: 150, source: "gumroad" },
];
const текст = ИСХОД.map((r) => JSON.stringify(r)).join("\n") + "\n";
const app = () => { const a = express(); a.use(express.json()); a.use("/p", provisioningRouter); return a; };
const строки = () => fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

beforeEach(() => { fs.writeFileSync(FILE, текст); process.env.ADMIN_TOKEN = "adm-test"; });

describe("backfill-billing", () => {
  test("dryRun по умолчанию: числа верные, файл не изменён ни на байт", async () => {
    const r = await request(app()).post("/p/subscriptions/backfill-billing").set("x-admin-token", "adm-test").send({});
    expect(r.status).toBe(200);
    console.log(`[backfill dryRun] ${JSON.stringify({ ...r.body, ids: r.body.ids })}`);
    expect(r.body).toMatchObject({ dryRun: true, строкLs: 6, безПоля: 5, monthly: 2, prepaid: 1, неОпределено: 1, доПлана: 1, записано: 0 });
    expect(fs.readFileSync(FILE, "utf8")).toBe(текст);
  });
  test("dryRun:false пишет два поля, начало — первая строка той же подписки, прочее не тронуто", async () => {
    const r = await request(app()).post("/p/subscriptions/backfill-billing").set("x-admin-token", "adm-test").send({ dryRun: false });
    expect(r.body.записано).toBe(3);
    const по = Object.fromEntries(строки().map((s) => [s.id, s]));
    expect(по.m1).toMatchObject({ billing: "monthly", commitStartedAt: "2026-10-19T10:00:00.000Z" });
    expect(по.m2).toMatchObject({ billing: "monthly", commitStartedAt: "2026-10-19T10:00:00.000Z" });
    expect(по.p1).toMatchObject({ billing: "prepaid", commitStartedAt: "2026-10-19T12:00:00.000Z" });
    for (const id of ["done", "old", "odd", "gum"]) expect(по[id]).toEqual(ИСХОД.find((x) => x.id === id));
    const { billing: _b, commitStartedAt: _c, ...безПолей } = по.m1;
    expect(безПолей).toEqual(ИСХОД[0]);
    // Повтор ничего не находит: дозапись идемпотентна.
    const r2 = await request(app()).post("/p/subscriptions/backfill-billing").set("x-admin-token", "adm-test").send({ dryRun: false });
    expect(r2.body).toMatchObject({ безПоля: 2, записано: 0 });
  });
  test("без токена 401, токен не задан — 503 (закрыто, а не открыто); файл цел", async () => {
    expect((await request(app()).post("/p/subscriptions/backfill-billing").send({ dryRun: false })).status).toBe(401);
    delete process.env.ADMIN_TOKEN;
    expect((await request(app()).post("/p/subscriptions/backfill-billing").send({ dryRun: false })).status).toBe(503);
    expect(fs.readFileSync(FILE, "utf8")).toBe(текст);
  });
});
