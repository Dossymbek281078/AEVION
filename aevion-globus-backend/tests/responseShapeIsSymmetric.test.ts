import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * Набор полей ответа не должен зависеть от того, КТО спрашивает.
 *
 * Класс подсказан соседней вкладкой 29.08.2026, и он не ловится ничем из
 * обычного: подстановку видно в коде (`?? 0`), а ПРОПУСК поля не виден нигде —
 * ни в коде, где просто нет строки, ни в одном ответе по отдельности. Он виден
 * только при сравнении двух ответов ОДНОЙ ручки для разных входов.
 *
 * Чем это дорого: отсутствующее поле читается как отрицательный ответ. «Нет
 * поля про ограничение» человек и код прочтут как «ограничений нет», хотя
 * правда — «мы про это не сказали». Ветка «нет доступа» или «бесплатный тариф»
 * обычно пишется отдельно, и забыть в ней поле легко.
 *
 * Сторож на СИММЕТРИЮ, а не на конкретное поле: «набор ключей не зависит от
 * входа» поймает следующий случай, «поле X присутствует» — только этот.
 *
 * Замер в день написания: 9 ручек × 3 варианта входа — расхождений НОЛЬ.
 * Прибор проверен подложенной асимметрией: поле, добавленное только для тарифа
 * pro, найдено и названо поимённо. Без этого контроля ноль был бы гипотезой.
 */

const { mockQuery, state } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  state: { tier: "free" as string },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: () => [], callProvider: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

mockQuery.mockImplementation(async (text: string) => {
  if (/FROM "DevHubTier"/i.test(text)) return { rows: [{ tier: state.tier }], rowCount: 1 };
  if (/FROM "DevHubUsage"/i.test(text)) return { rows: [{ used: 3 }], rowCount: 1 };
  return { rows: [], rowCount: 0 };
});

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}
function token(sub: string) {
  return jwt.sign({ sub, email: `${sub}@e.com`, role: "user" },
    process.env.AUTH_JWT_SECRET || "dev-auth-secret", { algorithm: "HS256" });
}

/** Ручки без обязательного идентификатора проекта. */
const PATHS = [
  "/api/devhub/health",
  "/api/devhub/templates",
  "/api/devhub/snippets",
  "/api/devhub/agent/templates",
  "/api/devhub/media/email-templates",
  "/api/devhub/media/3d/models",
  "/api/devhub/studio/credits",
  "/api/devhub/studio/capabilities",
  "/api/devhub/projects",
];

/**
 * Осознанные исключения: ручки, у которых набор полей ЗАКОННО зависит от
 * входа. Пусто на 29.08.2026 — и это факт замера, а не заготовка. Дописывая
 * сюда, объясняйте ПОЧЕМУ: без причины список превращается в способ гасить
 * находки.
 */
const EXPECTED_DIFFERENT: Record<string, string> = {};

type Variant = [name: string, headers: Record<string, string>, tier: string];
const VARIANTS: Variant[] = [
  ["гость", {}, "free"],
  ["вошёл-free", { Authorization: `Bearer ${token("u-free")}` }, "free"],
  ["вошёл-pro", { Authorization: `Bearer ${token("u-pro")}` }, "pro"],
];

/** Пути полей на два уровня вглубь; массивы — по первому элементу. */
function keysOf(v: unknown, prefix = "", depth = 0): string[] {
  if (depth > 2 || v === null || typeof v !== "object") return [];
  if (Array.isArray(v)) return v.length ? keysOf(v[0], prefix + "[]", depth + 1) : [];
  const out: string[] = [];
  for (const k of Object.keys(v as object)) {
    out.push(prefix + "." + k);
    out.push(...keysOf((v as Record<string, unknown>)[k], prefix + "." + k, depth + 1));
  }
  return out;
}

async function shapeOf(path: string, v: Variant): Promise<string[]> {
  state.tier = v[2];
  const r = await request(makeApp()).get(path).set(v[1]);
  return r.status === 200 ? keysOf(r.body).sort() : [`<status ${r.status}>`];
}

describe("набор полей ответа не зависит от того, кто спрашивает", () => {
  test("контроль: ручки отвечают и поля разбираются", async () => {
    // Без этого пустые ответы «совпали бы» и сторож был бы зелёным впустую.
    const keys = await shapeOf("/api/devhub/studio/credits", VARIANTS[0]);
    expect(keys.length, "ответ пуст — сторож ничего не сравнивает").toBeGreaterThan(5);
    expect(keys.some((k) => k.includes("usage")), "разобран не тот ответ").toBe(true);
  }, 60000);

  test.each(PATHS)("%s отдаёт одинаковый набор полей всем", async (path) => {
    if (EXPECTED_DIFFERENT[path]) return;
    // ПОСЛЕДОВАТЕЛЬНО, а не Promise.all: варианты делят одно изменяемое
    // состояние тарифа, и при параллельном запуске оно затирается — все три
    // запроса видят один тариф, то есть варианты перестают варьироваться.
    // Сторож при этом выглядит рабочим и зелёным. Поймано мутацией: поле,
    // добавленное только для pro, проходило мимо.
    const shapes: string[][] = [];
    for (const v of VARIANTS) shapes.push(await shapeOf(path, v));
    const union = [...new Set(shapes.flat())].sort();
    const report = VARIANTS.map((v, i) => {
      const missing = union.filter((k) => !shapes[i].includes(k));
      return missing.length ? `${v[0]} НЕ имеет: ${missing.join(", ")}` : "";
    }).filter(Boolean);
    expect(
      report,
      "набор полей зависит от входа. Отсутствующее поле читается как " +
        "отрицательный ответ («ограничений нет»), хотя правда — «мы про это не " +
        "сказали». Либо добавьте поле во все ветки, либо внесите путь в " +
        "EXPECTED_DIFFERENT с причиной.",
    ).toEqual([]);
  }, 60000);
});
