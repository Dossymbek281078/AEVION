import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Суточный лимит ИИ переживает выкатку, и в базу уходит ХЕШ, а не адрес.
 *
 * Замер 30.08.2026: счётчик жил в `Map` внутри процесса. Перезапуск обнулял
 * его, а перезапуск случается при каждой выкатке — значит предел «10 запросов
 * в сутки» на деле означал «10 на промежуток между выкатками». Механизм был
 * верный, срок жизни неверный: окно предела длиннее жизни процесса.
 *
 * 🔒 Раз данные стали постоянными, они не должны быть персональными. В таблицу
 * кладётся sha256 от адреса с солью — образец взят у воронки конституции
 * (столбец fpHash). Тест проверяет это ПО ПАРАМЕТРАМ ЗАПРОСА, а не по коду:
 * греп не заметил бы, если адрес просочится другим путём.
 */

const { mockQuery, state } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  state: { rows: new Map<string, number>(), fails: false, seen: [] as unknown[][] },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { aiRateGate, __resetAiDailyTableState } from "../src/lib/constitutionGate";

const IP = "203.0.113.9";

beforeEach(() => {
  state.rows.clear();
  state.fails = false;
  state.seen = [];
  __resetAiDailyTableState();
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (text: string, params?: unknown[]) => {
    if (state.fails) throw new Error("db down");
    if (params) state.seen.push(params);
    if (/CREATE TABLE/i.test(text)) return { rows: [], rowCount: 0 };
    if (/SELECT "count"/i.test(text)) {
      const k = String(params?.[1]);
      const v = state.rows.get(k);
      return { rows: v === undefined ? [] : [{ count: v }], rowCount: v === undefined ? 0 : 1 };
    }
    if (/INSERT INTO constitution_ai_daily/i.test(text)) {
      const k = String(params?.[1]);
      state.rows.set(k, (state.rows.get(k) ?? 0) + 1);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
});

function app() {
  const a = express();
  a.set("trust proxy", true);
  a.use(express.json());
  a.get("/probe", aiRateGate as unknown as express.RequestHandler, (_req, res) => {
    res.json({ ok: true });
  });
  return a;
}

async function hit() {
  return request(app()).get("/probe").set("X-Forwarded-For", IP);
}

describe("суточный лимит ИИ конституции", () => {
  test("контроль: первый запрос проходит и что-то записано", async () => {
    const r = await hit();
    expect(r.status, r.text.slice(0, 200)).toBe(200);
    expect(state.rows.size, "в базу ничего не записалось — счёт не ведётся").toBe(1);
  });

  test("🔒 в базу уходит ХЕШ, а не адрес посетителя", async () => {
    await hit();
    const flat = JSON.stringify(state.seen);
    expect(flat.includes(IP), "адрес посетителя попал в постоянное хранилище").toBe(false);
    const key = [...state.rows.keys()][0];
    expect(key.length, "ключ не похож на хеш").toBeGreaterThan(16);
  });

  test("счёт ПЕРЕЖИВАЕТ перезапуск процесса", async () => {
    // Дважды сходили, потом «выкатка»: состояние модуля сброшено, строки в базе
    // остались. Раньше счёт жил только в памяти и обнулялся здесь.
    await hit();
    await hit();
    const beforeRestart = [...state.rows.values()][0];
    expect(beforeRestart).toBe(2);

    __resetAiDailyTableState();
    await hit();
    expect(
      [...state.rows.values()][0],
      "после перезапуска счёт начался заново — предел снова «на промежуток между выкатками»",
    ).toBe(3);
  });

  test("при недоступной базе отвечает, а не падает", async () => {
    state.fails = true;
    const r = await hit();
    expect(r.status, "отказ базы уронил запрос вместо запасного пути").toBe(200);
  });
});
