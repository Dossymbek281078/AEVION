import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { klassUstroystva } from "../src/lib/klassUstroystva";

/*
 * 🔴 Ушедшие без шага с /devhub — по устройству и часу, строка браузера наружу не идёт.
 *
 * Повод 13.10.2026 (оркестратор): 12 живых открыли /devhub и не дали ни одного
 * шага первого экрана; сеть это (мобильные ночью) или витрина — событиями не
 * видно. Сторож делает настоящий GET к /funnel и проверяет ТЕЛО ответа.
 * ⚠️ Импорт модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-ushli-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const ТЕЛЕФОН = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const АНДРОИД = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const ПЛАНШЕТ = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1";
const СТОЛ = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 2026-10-12T20:30Z = 13.10 01:30 по Алматы; 2026-10-13T06:00Z = 11:00 по Алматы
const НОЧЬ = "2026-10-12T20:30:00.000Z";
const ДЕНЬ = "2026-10-13T06:00:00.000Z";

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify(о)).join("\n") + "\n");
}

beforeAll(async () => { await import("../src/routes/events"); }, 120_000);
beforeEach(() => { журнал([]); });
afterAll(() => { rmSync(каталог, { recursive: true, force: true }); });

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

describe("класс устройства по строке браузера", () => {
  it("телефоны, планшеты, стол и пустая строка различаются", () => {
    expect(klassUstroystva(ТЕЛЕФОН)).toBe("mobile");
    expect(klassUstroystva(АНДРОИД)).toBe("mobile");
    expect(klassUstroystva(ПЛАНШЕТ)).toBe("tablet");
    expect(klassUstroystva(СТОЛ)).toBe("desktop");
    expect(klassUstroystva("")).toBe("unknown");
    expect(klassUstroystva(undefined)).toBe("unknown");
  });
});

describe("ушедшие без шага с /devhub — в теле /funnel", () => {
  it("🔴 считаются только живые без шага; устройство и час Алматы верны; наши отдельно; строки браузера в ответе нет", async () => {
    журнал([
      // живой с телефона ночью — ушёл без шага
      { type: "page_view", sid: "т1", path: "/devhub?c=yt-devhub-1", ts: НОЧЬ, ua: ТЕЛЕФОН },
      // живой со стола днём — ушёл без шага
      { type: "page_view", sid: "с1", path: "/devhub", ts: ДЕНЬ, ua: СТОЛ },
      // живой с планшета — сделал шаг: в «ушедшие» не входит
      { type: "page_view", sid: "п1", path: "/devhub", ts: ДЕНЬ, ua: ПЛАНШЕТ },
      { type: "feature_use", sid: "п1", source: "devhub", path: "/devhub", ts: ДЕНЬ, ua: ПЛАНШЕТ, meta: { feature: "textarea_focus" } },
      // наша проба — отдельным числом, в разрезы не входит
      { type: "page_view", sid: "наш", path: "/devhub?c=probe-user-99", ts: НОЧЬ, ua: СТОЛ },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=400");
    expect(r.status).toBe(200);
    const у = r.body.devhubUshliBezShaga;
    expect(у, "поле обязано лежать в ТЕЛЕ ответа").toBeTruthy();
    expect(у.сессий).toBe(3);
    expect(у.сессийНаших).toBe(1);
    expect(у.поУстройству).toEqual({ mobile: 1, tablet: 0, desktop: 1, unknown: 0 });
    expect(у.поЧасамАлматы).toEqual({ "01": 1, "11": 1 });
    expect(JSON.stringify(r.body)).not.toContain("iPhone OS 17_0");
    expect(typeof r.body.devhubUshliBezShagaNote).toBe("string");
  });

  it("контроль: событий нет — нули и пустые разрезы, поле не пропадает", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.body.devhubUshliBezShaga).toEqual({
      сессий: 0, сессийНаших: 0, поУстройству: { mobile: 0, tablet: 0, desktop: 0, unknown: 0 }, поЧасамАлматы: {},
    });
  });
});
