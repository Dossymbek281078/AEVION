import { describe, expect, test, vi, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 Задача дня для гостя — всегда в диапазоне новичка, на 30 подряд датах.
 *
 * ПОВОД 11.10.2026: задача дня имела рейтинг **2269** при рейтинге игрока по
 * умолчанию 800 (замер окна 3d на живой ручке). Выбор шёл по ВСЕМУ банку —
 * сложность была неуправляемой by design. Рядом число окна воронки: за 7 дней
 * 10 живых начали партию и ноль доиграли.
 *
 * Сторож делает ЗАПРОС К РУЧКЕ и читает ТЕЛО ответа — не свою копию правила:
 * копия проверила бы замысел, а не работу. Банк подменён, время подменено.
 */

const БАНК = Array.from({ length: 400 }, (_, i) => ({
  id: `p${String(i).padStart(3, "0")}`,
  fen: `8/8/8/8/8/8/8/K6k w - - 0 ${i}`,
  sol: JSON.stringify(["e2e4", "e7e5"]),
  name: `Задача ${i}`,
  rating: 600 + Math.round(i * 5.5),
  theme: "Тактика",
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (текст: string, параметры?: unknown[]) => {
      const сФильтром = /BETWEEN/i.test(текст);
      const мин = Number(параметры?.[0] ?? 0), макс = Number(параметры?.[1] ?? 0);
      const набор = сФильтром ? БАНК.filter((p) => p.rating >= мин && p.rating <= макс) : БАНК;
      if (/count/i.test(текст)) return { rows: [{ n: набор.length }] };
      const offset = Number(параметры?.[сФильтром ? 2 : 0] ?? 0);
      const упор = [...набор].sort((a, b) => (a.id < b.id ? -1 : 1));
      return { rows: упор[offset] ? [упор[offset]] : [] };
    },
  }),
  getPoolStats: () => null,
}));

const модуль = await import("../src/routes/cyberchessDaily");
const ДИАПАЗОН = (модуль as unknown as { ДИАПАЗОН_ЗАДАЧИ_ДНЯ: { мин: number; макс: number } }).ДИАПАЗОН_ЗАДАЧИ_ДНЯ;

const app = express();
app.use("/api/cyberchess-daily", (модуль as unknown as { default: express.Router }).default);

afterAll(() => { vi.useRealTimers(); });

async function рейтингНаДату(iso: string): Promise<number | null> {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T09:00:00Z`));
  const r = await request(app).get("/api/cyberchess-daily/puzzle");
  vi.useRealTimers();
  if (r.status !== 200) return null;
  return Number(r.body?.puzzle?.rating ?? NaN);
}

describe("сложность задачи дня (запрос к ручке)", () => {
  test("🔴 на 30 подряд датах рейтинг всегда в диапазоне новичка", async () => {
    const рейтинги: Array<number | null> = [];
    for (let d = 1; d <= 30; d++) рейтинги.push(await рейтингНаДату(`2026-11-${String(d).padStart(2, "0")}`));
    const неотвеченные = рейтинги.filter((r) => r === null || !Number.isFinite(r));
    expect(неотвеченные.length, `ручка не ответила на ${неотвеченные.length} датах из 30`).toBe(0);
    const вне = (рейтинги as number[]).filter((r) => r < ДИАПАЗОН.мин || r > ДИАПАЗОН.макс);
    expect(вне.length, `вне диапазона ${вне.length} из 30: ${вне.slice(0, 5).join(", ")}`).toBe(0);
    // Знаменатель и контроль «не одна и та же задача каждый день».
    expect(new Set(рейтинги).size, "все 30 дат дали один рейтинг — выбор перестал зависеть от даты").toBeGreaterThan(1);
  }, 60000);

  test("🔴 КОНТРОЛЬ: банк содержит задачи ВНЕ диапазона, иначе проверка пустая", () => {
    const вне = БАНК.filter((p) => p.rating < ДИАПАЗОН.мин || p.rating > ДИАПАЗОН.макс).length;
    expect(вне, "в подменённом банке нет задач вне диапазона — сторож не отличил бы фильтр от его отсутствия")
      .toBeGreaterThan(100);
  });

  test("диапазон назван числами", () => {
    expect([ДИАПАЗОН.мин, ДИАПАЗОН.макс]).toEqual([800, 1200]);
  });
});
