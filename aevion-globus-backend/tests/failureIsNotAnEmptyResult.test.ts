// Отказ не имеет права выглядеть законной пустотой.
//
// Найдено разбором catch-блоков 19.08.2026. Три ручки отвечали УСПЕХОМ на
// упавший запрос, и каждая — правдоподобной пустотой, неотличимой от нормы:
//
//   awards   /health  -> {status:"ok"} без поля seasons, когда база недоступна;
//   qcontract /stats  -> {totalDocuments:0,...} читается как «у вас пусто»;
//   puzzles   /       -> {ok:true,total:0,puzzles:[]} = пустой тренажёр.
//
// Ни одна не падала, ни одна не попадала в Sentry: 200 OK на каждый запрос.
// Это тот же класс, что «подтверждение адреса вернуло ok:true, не отправив
// письма» — успех отчитывается за несделанную работу.
//
// Тест держит ГРАНИЦУ, а не код ответа: законная пустота (фильтр не совпал)
// обязана остаться 200, иначе мы поменяем молчаливый дефект на ложную тревогу
// и приучим себя не читать её.

import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";

// База, которая всегда падает: так выглядит недоступное хранилище.
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => {
      throw new Error("storage unreachable");
    },
  }),
}));

function mount(router: express.Router, base: string) {
  const app = express();
  app.use(base, router);
  return app;
}

describe("упавшее хранилище не отчитывается успехом", () => {
  test("awards /health не отвечает ok, не дотянувшись до базы", async () => {
    const { awardsRouter } = await import("../src/routes/awards");
    const res = await request(mount(awardsRouter, "/api/awards")).get("/api/awards/health");

    expect(res.status).not.toBe(200);
    expect(res.body.status).not.toBe("ok");
  });

  test("awards /health не выдаёт наружу устройство хранилища", async () => {
    const { awardsRouter } = await import("../src/routes/awards");
    const res = await request(mount(awardsRouter, "/api/awards")).get("/api/awards/health");

    // Категория — да, сообщение драйвера — нет: в нём бывают хост, порт и
    // пользователь базы, а ручка публичная.
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/storage unreachable/);
    expect(res.body.reason).toBe("storage_unreachable");
  });

  test("qcontract /stats не выдаёт нули за факт", async () => {
    const { qcontractRouter } = await import("../src/routes/qcontract");
    const res = await request(mount(qcontractRouter, "/api/qcontract")).get("/api/qcontract/stats");

    expect(res.status).not.toBe(200);
    expect(res.body.totalDocuments).not.toBe(0);
  });
});

describe("cyberchess-puzzles: пустой пул и пустой фильтр — разные вещи", () => {
  const src = readFileSync(
    path.join(__dirname, "..", "src", "routes", "cyberchessPuzzles.ts"),
    "utf8",
  );
  // Комментарии вырезаются: в этом файле они называют ровно те строки, что
  // ищет сторож, и без вырезания он краснел бы на собственном объяснении.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("провал загрузки пула отвечает отказом, а не пустым тренажёром", () => {
    expect(code).toMatch(/POOL\.length === 0/);
    expect(code).toMatch(/puzzle_pool_empty/);
  });

  test("упавший запрос отвечает отказом", () => {
    expect(code).toMatch(/puzzle_query_failed/);
  });

  test("ни один catch в файле не отвечает ok:true", () => {
    // Резать файл от последнего catch до конца НЕЛЬЗЯ: в хвосте живёт ручка
    // /reload с законным ok:true, и сторож краснел бы на ней. Границу блока
    // надо считать по скобкам — иначе прибор врёт, а не код.
    const bodies: string[] = [];
    for (const m of code.matchAll(/(^|[^A-Za-z0-9_$])catch\s*(\([^)]*\))?\s*\{/gm)) {
      let i = (m.index ?? 0) + m[0].length - 1; // индекс открывающей {
      let depth = 0;
      let j = i;
      for (; j < code.length; j++) {
        if (code[j] === "{") depth++;
        else if (code[j] === "}" && --depth === 0) break;
      }
      bodies.push(code.slice(i, j + 1));
    }
    expect(bodies.length).toBeGreaterThan(0); // иначе тест проверяет пустоту
    for (const b of bodies) expect(b).not.toMatch(/ok:\s*true/);
  });
});
