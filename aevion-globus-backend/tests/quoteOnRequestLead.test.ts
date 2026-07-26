import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Кнопка «цена по запросу» на витринах модулей без à-la-carte цены (8 из 43)
 * ведёт на /pricing/contact?module=…, а форма отправляет лид с `modules: [id]`.
 * Смысл всей кнопки — чтобы спрос стал ВИДЕН ПОИМЁННО: без названия модуля лид
 * ничем не отличается от обычного обращения, и «нельзя купить» так и остаётся
 * молчанием.
 *
 * Путь проверен чтением кода; здесь он закрепляется, потому что ломается тихо:
 * поле просто перестанет доезжать, ошибки не будет.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-leads-"));
const LEADS = join(TMP, "leads.jsonl");
process.env.LEADS_FILE = LEADS;

let app: express.Express;

/** Запас на первый импорт роутера под нагрузкой — см. tests/tier3OgRoutes. */
const IMPORT_TIMEOUT_MS = 30_000;

beforeAll(async () => {
  const { pricingRouter } = await import("../src/routes/pricing");
  app = express();
  app.use(express.json());
  app.use("/api/pricing", pricingRouter);
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

function storedLeads() {
  if (!existsSync(LEADS)) return [];
  return readFileSync(LEADS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

describe("лид «цена по запросу» доносит имя модуля", () => {
  test("modules[] и source сохраняются в лиде", async () => {
    const r = await request(app).post("/api/pricing/lead").send({
      name: "Тест",
      email: "quote@test.aevion.dev",
      modules: ["qskyway"],
      message: "Интересует модуль qskyway — нужна цена.",
      source: "pricing/contact?module=qskyway",
    });
    expect(r.status).toBeLessThan(300);

    const mine = storedLeads().filter((l) => l.email === "quote@test.aevion.dev");
    expect(mine).toHaveLength(1);
    expect(mine[0].modules).toEqual(["qskyway"]);          // спрос виден поимённо
    expect(mine[0].source).toContain("module=qskyway");    // и видно, откуда пришёл
  }, IMPORT_TIMEOUT_MS);

  test("лид без модулей по-прежнему принимается (обычное обращение)", async () => {
    const r = await request(app).post("/api/pricing/lead").send({
      name: "Тест",
      email: "plain@test.aevion.dev",
      message: "Общий вопрос",
      source: "pricing/contact",
    });
    expect(r.status).toBeLessThan(300);
    const mine = storedLeads().filter((l) => l.email === "plain@test.aevion.dev");
    expect(mine).toHaveLength(1);
    expect(mine[0].modules ?? []).toEqual([]);
  }, IMPORT_TIMEOUT_MS);
});
