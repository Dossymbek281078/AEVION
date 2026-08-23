import { describe, test, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { pgIntId, PG_INT_MAX } from "../src/lib/queryNumber";
import { mapRealityRouter } from "../src/routes/mapReality";
import { voiceOfEarthRouter } from "../src/routes/voiceOfEarth";
import { startupExchangeRouter } from "../src/routes/startupExchange";

/**
 * `?id=99999999999999999999` — 400, а не тихий 404 с записью в Sentry.
 *
 * Найдено в Sentry 19.08.2026:
 *
 *   GET /api/mapreality/signals/99999999999999999999
 *   error: value "100000000000000000000" is out of range for type integer
 *
 * Проверка была `Number.isFinite(id) && id > 0`, и 1e20 её проходит: число
 * конечное и положительное. Колонка `id` объявлена как SERIAL — это 32-битное
 * целое с потолком 2 147 483 647.
 *
 * Дефект прятался вдвойне. Ошибка попадала в `catch`, обработчик уходил в
 * запасное хранилище в памяти, ничего там не находил — и наружу шёл
 * правдоподобный 404. То есть снаружи ручка выглядела исправной, а Sentry
 * набирал ошибку на каждый заход робота. Клиентской ошибке место в 400
 * (правило 15г): 5xx поднимает людей и хоронит настоящие аварии в шуме.
 */

describe("pgIntId", () => {
  test("контроль: обычный идентификатор проходит", () => {
    expect(pgIntId("1")).toBe(1);
    expect(pgIntId(42)).toBe(42);
    expect(pgIntId(String(PG_INT_MAX))).toBe(PG_INT_MAX);
  });

  test("всё, что Postgres не примет в integer, отсекается", () => {
    expect(pgIntId("99999999999999999999")).toBeNull(); // тот самый из Sentry
    expect(pgIntId(String(PG_INT_MAX + 1))).toBeNull(); // ровно за границей
    expect(pgIntId("1.5")).toBeNull();
    expect(pgIntId("0")).toBeNull();
    expect(pgIntId("-1")).toBeNull();
    expect(pgIntId("zzz")).toBeNull();
    expect(pgIntId("")).toBeNull();
    expect(pgIntId(undefined)).toBeNull();
    expect(pgIntId(["1", "2"])).toBe(1); // ?id=1&id=2 — берём первое
  });

  test("контроль: старая проверка это ПРОПУСКАЛА", () => {
    const old = (raw: unknown) => {
      const id = Number(raw);
      return Number.isFinite(id) && id > 0;
    };
    expect(old("99999999999999999999")).toBe(true); // вот и вся дыра
    expect(old("1.5")).toBe(true);
  });
});

describe("ручки отвечают 400, а не тихим 404", () => {
  // startupExchange на импорте запускает не-ожидаемую подготовку таблиц
  // (IIFE с await внутри). Её лог приходит уже после конца файла, и vitest
  // валит прогон EnvironmentTeardownError «Closing rpc while onUserConsoleLog
  // was pending» — при девяти зелёных тестах. Даём ей досказать. Трогать сам
  // модуль ради теста не стал: это чужая зона и другая задача.
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  const app = express();
  app.use(express.json());
  app.use("/api/mapreality", mapRealityRouter);
  app.use("/api/voiceofearth", voiceOfEarthRouter);
  app.use("/api/startupx", startupExchangeRouter);

  const HUGE = "99999999999999999999";

  test.each([
    ["/api/mapreality/signals", "MapReality (тот самый из Sentry)"],
    ["/api/voiceofearth/tracks", "VoiceOfEarth"],
    ["/api/startupx/ideas", "StartupExchange (замер на проде 23.08: отвечал тихим 404)"],
  ])("%s/<огромный id> → 400", async (base) => {
    const res = await request(app).get(`${base}/${HUGE}`);
    expect(
      res.status,
      `ожидали 400; ${res.status} означает, что число доехало до SQL`,
    ).toBe(400);
  });

  test("контроль: нормальный несуществующий id даёт НЕ 400", async () => {
    // Иначе тест был бы зелёным и на ручке, которая всем отвечает 400.
    const res = await request(app).get("/api/mapreality/signals/123456");
    expect(res.status).not.toBe(400);
  });
});

// ─── сторож по исходникам ────────────────────────────────────────────────────

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

// Две записи одной ошибки. Сторож родился из случая в Sentry, где стояло
// `Number.isFinite`, и знал ровно эту букву. Замер 23.08.2026: ещё семь мест
// писали `Number.isInteger` — дробное они отбивают, а 1e20 проходит так же,
// потому что 1e20 целое. Сторож их не видел, хотя дефект тот же.
//
// Верхняя граница у обеих форм отсутствует одинаково, поэтому и шаблон один.
// Нижняя граница пишется и как `< 1`, и как `<= 0` — тоже одна и та же мысль.
const OLD_SHAPE = /!Number\.(isFinite|isInteger)\((\w*[Ii]d|prNumber)\)\s*\|\|\s*\2\s*(<=\s*0|<\s*1)/;

describe("сторож: проверка id без верхней границы не возвращается", () => {
  const files = tsFiles(join(__dirname, "..", "src", "routes"));

  test("контроль: сканер читает файлы и умеет краснеть", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(OLD_SHAPE.test("if (!Number.isFinite(id) || id <= 0) return;")).toBe(true);
    expect(OLD_SHAPE.test("if (id === null) return;")).toBe(false);
    // Вторая буква той же ошибки — из-за неё сторож молчал про семь мест.
    expect(OLD_SHAPE.test("if (!Number.isInteger(id) || id < 1) return;")).toBe(true);
    expect(OLD_SHAPE.test("if (!Number.isInteger(id) || id <= 0) return;")).toBe(true);
    expect(OLD_SHAPE.test("if (!Number.isInteger(prNumber) || prNumber <= 0) {")).toBe(true);
    // И контроль в другую сторону: починенная форма краснеть не должна.
    expect(OLD_SHAPE.test("const id = pgIntId(req.params.id);")).toBe(false);
  });

  test("нигде нет проверки id, которую 1e20 проходит", () => {
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*")) return;
        if (OLD_SHAPE.test(line)) bad.push(`${f.split(/[\/]/).slice(-2).join("/")}:${i + 1}`);
      });
    }
    expect(bad, `1e20 пройдёт эту проверку и уедет в SQL:\n${bad.join("\n")}`).toEqual([]);
  });
});
