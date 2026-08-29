import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import express from "express";

// Пути к файлам заявок в pricing.ts должны читаться ПРИ ВЫЗОВЕ, а не при
// импорте модуля.
//
// Раньше это были шесть констант уровня модуля (LEADS_FILE, NEWSLETTER_FILE,
// AFFILIATE_FILE, PARTNERS_FILE, EDU_FILE, PARTNER_DEALS_FILE). Тест,
// выставляющий переменную во временную папку, ничего не менял, если модуль уже
// импортирован транзитивно — и заявки уезжали в РЕАЛЬНЫЕ data/*.jsonl,
// переживая прогон. Та же форма, что доказана на provisioning.ts (issue #982).
//
// КЛЮЧЕВОЕ: роутер импортируется здесь, на верхнем уровне файла, ДО того как
// beforeEach выставит переменные. Импорт после установки прошёл бы и со старым
// кодом, то есть не проверял бы ничего.
import { pricingRouter } from "../src/routes/pricing";

let dir: string;

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pricing-paths-test-"));
  process.env.LEADS_FILE = path.join(dir, "leads.jsonl");
  process.env.NEWSLETTER_FILE = path.join(dir, "newsletter.jsonl");
  process.env.AFFILIATE_FILE = path.join(dir, "affiliate.jsonl");
  process.env.PARTNERS_FILE = path.join(dir, "partners.jsonl");
  process.env.EDU_FILE = path.join(dir, "edu.jsonl");
  process.env.PARTNER_DEALS_FILE = path.join(dir, "partner-deals.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of [
    "LEADS_FILE",
    "NEWSLETTER_FILE",
    "AFFILIATE_FILE",
    "PARTNERS_FILE",
    "EDU_FILE",
    "PARTNER_DEALS_FILE",
  ]) {
    delete process.env[k];
  }
});

describe("заявки пишутся в файл из окружения, а не в дефолтный", () => {
  test("лид уходит во временный файл, заданный после импорта модуля", async () => {
    const r = await request(app())
      .post("/api/pricing/lead")
      .send({ name: "Тест Тестов", email: "lead@test.aevion.dev", tier: "medium", source: "vitest" });

    expect([200, 201]).toContain(r.status);

    const file = process.env.LEADS_FILE!;
    expect(existsSync(file), "лид должен лежать во временном файле, а не в data/leads.jsonl").toBe(true);
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).email).toBe("lead@test.aevion.dev");
  });

  test("счётчик лидов читает тот же файл, в который писал", async () => {
    await request(app())
      .post("/api/pricing/lead")
      .send({ name: "Первый Лид", email: "one@test.aevion.dev", source: "vitest" });

    const c = await request(app()).get("/api/pricing/leads/count");
    expect(c.status).toBe(200);
    expect(c.body.total).toBe(1);
  });

  test("смена переменной между запросами меняет файл назначения", async () => {
    await request(app())
      .post("/api/pricing/lead")
      .send({ name: "Лид Первый", email: "a@test.aevion.dev", source: "vitest" });

    const second = path.join(dir, "leads-2.jsonl");
    process.env.LEADS_FILE = second;

    await request(app())
      .post("/api/pricing/lead")
      .send({ name: "Лид Второй", email: "b@test.aevion.dev", source: "vitest" });

    expect(readFileSync(second, "utf8").split("\n").filter((l) => l.trim())).toHaveLength(1);
    // Счётчик теперь тоже смотрит на новый файл — путь един для чтения и записи.
    const c = await request(app()).get("/api/pricing/leads/count");
    expect(c.body.total).toBe(1);
  });

  test("настоящий data/ не трогается ни одним из запросов", async () => {
    // Прямая проверка того, ради чего правка: до неё фикстуры уезжали в
    // реальный файл репозитория и переживали прогон.
    const realLeads = path.join(process.cwd(), "data", "leads.jsonl");
    const before = existsSync(realLeads) ? readFileSync(realLeads, "utf8") : null;

    await request(app())
      .post("/api/pricing/lead")
      .send({ name: "Не Должен Попасть", email: "leak@test.aevion.dev", source: "vitest" });

    const after = existsSync(realLeads) ? readFileSync(realLeads, "utf8") : null;
    expect(after).toBe(before);
    if (after) expect(after).not.toContain("leak@test.aevion.dev");
  });
});
