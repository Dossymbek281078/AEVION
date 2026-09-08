import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Управляющие байты в адресе — 400, а не 500.
 *
 * Замер прода 08.09.2026: «%00» в пути доезжал до параметра запроса,
 * Postgres такую строку не принимал, и наш catch объявлял это отказом
 * ХРАНИЛИЩА: /api/qright/objects/%00, /api/planet/artifacts/%00/public,
 * /api/bureau/notaries/%00 отвечали 500 (контроль «abc» — честные 404), а
 * devhub отвечал 503 и КРАСИЛ полосу здоровья по чужому кривому запросу.
 * Цена: каждая такая ссылка бесплатно рождает тревогу в Sentry, среди
 * которых потом не видно настоящих аварий.
 *
 * Проверяется ПОВЕДЕНИЕ прослойки (собрана из исходника index.ts), а не её
 * наличие: «строка есть в файле» — не то же, что «запрос получил 400».
 */

function прослойка() {
  // Берём код из ЖИВОГО index.ts, а не пишем копию правила рядом: копия
  // пережила бы удаление оригинала и сторож бы этого не заметил.
  const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
  const начало = src.indexOf("app.use((req, res, next) => {");
  const конец = src.indexOf("app.use(express.json({", начало);
  expect(начало, "прослойка управляющих байтов исчезла из index.ts").toBeGreaterThan(0);
  const кусок = src.slice(начало, конец).replace(/^app\.use\(/, "(").replace(/\);\s*$/, ")");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("return " + кусок)() as express.RequestHandler;
}

function приложение() {
  const app = express();
  app.use(прослойка());
  app.get("/api/probe/:id", (req, res) => res.json({ ok: true, id: req.params.id }));
  return app;
}

describe("управляющие байты в адресе", () => {
  it("обычный адрес проходит (контроль прибора)", async () => {
    const r = await request(приложение()).get("/api/probe/abc");
    expect(r.status).toBe(200);
    expect(r.body.id).toBe("abc");
  });

  it("NUL в адресе — 400, а не 5xx", async () => {
    const r = await request(приложение()).get("/api/probe/%00");
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/control characters/i);
  });

  it("NUL в середине значения — тоже 400", async () => {
    const r = await request(приложение()).get("/api/probe/abc%00def");
    expect(r.status).toBe(400);
  });

  it("битая процентная последовательность — 400, не падение", async () => {
    const r = await request(приложение()).get("/api/probe/%zz");
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/percent/i);
  });

  it("безобидные не-ASCII проходят: правило про УПРАВЛЯЮЩИЕ, не про юникод", async () => {
    const r = await request(приложение()).get("/api/probe/" + encodeURIComponent("тест"));
    expect(r.status).toBe(200);
  });
});

describe("прослойка не перегибает: обычные адреса живут", () => {
  it("латиница, цифры, дефисы, подчёркивания, точки — проходят", async () => {
    const app = приложение();
    for (const id of ["abc", "cert-4bc586a1af49", "qs_0dfba1bf", "v2.1", "a1b2c3"]) {
      const r = await request(app).get("/api/probe/" + id);
      expect(r.status, `обычный id «${id}» отбит — это перегиб`).toBe(200);
    }
  });

  it("процентное кодирование безобидных символов проходит", async () => {
    // %20 (пробел) и %2F в значении — законные адреса, а не атака.
    const r = await request(приложение()).get("/api/probe/" + encodeURIComponent("hello world"));
    expect(r.status).toBe(200);
  });

  it("эмодзи и китайский проходят: правило про управляющие, не про алфавит", async () => {
    for (const s of ["日本語", "🎯"]) {
      const r = await request(приложение()).get("/api/probe/" + encodeURIComponent(s));
      expect(r.status, `«${s}» отбит — правило слишком широкое`).toBe(200);
    }
  });
});
