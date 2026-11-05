import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/*
 * 🔴 5.11.2026: все 10 «прошедших событий» прода — сиды от учётки 652ca4d7…, этих событий не было.
 * Отбор идёт в SQL, поэтому тест смотрит и на запрос, и на то, что карточка по id открывается.
 */
const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureQEventsTables", () => ({ ensureQEventsTables: vi.fn(), isQEventsDbReady: () => true }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => undefined }));

// eslint-disable-next-line import/first
import { qeventsRouter, демоОрганизатор } from "../src/routes/qevents";

const ДЕМО = "652ca4d7-c4f4-4519-8bd9-562adab2ec2a";
const app = () => { const a = express(); a.use(express.json()); a.use(qeventsRouter); return a; };

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
});

describe("сиды QEvents не выдаются за события", () => {
  test.each(["upcoming", "past", "all"])("лента when=%s исключает демо-организатора в SQL", async (when) => {
    const r = await request(app()).get(`/events?when=${when}`);
    expect(r.status).toBe(200);
    const [sql, params] = query.mock.calls.at(-1)!;
    expect(sql).toMatch(/NOT \("organizerId"::text = ANY\(\$1::text\[\]\)\)/);
    expect(params[0]).toEqual([ДЕМО]);
    expect(params.at(-1)).toBe(20);
  });
  test("фильтр категории не сбивает нумерацию параметров", async () => {
    await request(app()).get("/events?when=past&category=tech&limit=5");
    const [sql, params] = query.mock.calls.at(-1)!;
    expect(sql).toContain('"startAt"<$2');
    expect(sql).toContain('"category"=$3');
    expect(sql).toContain("LIMIT $4");
    expect(params.slice(2)).toEqual(["tech", 5]);
  });
  test("календарь исключает демо-организатора", async () => {
    const r = await request(app()).get("/calendar?year=2026&month=6");
    expect(r.status).toBe(200);
    const [sql, params] = query.mock.calls.at(-1)!;
    expect(sql).toContain("ANY($3::text[])");
    expect(params[2]).toEqual([ДЕМО]);
  });
  test("карточка по прямому id открывается", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "e1", organizerId: ДЕМО, title: "t" }] });
    const r = await request(app()).get("/events/e1");
    expect(r.status).toBe(200);
    expect(r.body.event.id).toBe("e1");
  });
  test("настоящий организатор не считается демо", () => {
    expect(демоОрганизатор(ДЕМО)).toBe(true);
    expect(демоОрганизатор("real-user")).toBe(false);
  });
});
