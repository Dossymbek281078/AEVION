import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * «Сгорает после N прочтений» — главная функция продукта QContract ($19/мес).
 * Держалась она на схеме «SELECT view_count → проверили → UPDATE +1», между
 * которыми ничего не стояло: два одновременных запроса читали одинаковый
 * счётчик, оба проходили проверку и оба инкрементировали. Документ с
 * max_views=1 открывался столько раз, сколько параллельных запросов послали.
 *
 * Теперь прочтение занимается одним UPDATE с условием в WHERE — база решает под
 * блокировкой строки, кому досталось последнее. Проверяем именно это: когда
 * занять не удалось, содержимое НЕ отдаётся и просмотр НЕ пишется в журнал.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qcontractRouter } from "../src/routes/qcontract";

const DOC = {
  id: "doc-1",
  title: "Договор",
  content: "секретное содержимое",
  content_type: "text",
  password_hash: null,
  max_views: 1,
  view_count: 0,
  expires_at: null,
  revoked_at: null,
  require_signature: false,
  qright_id: null,
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qcontract", qcontractRouter);
  return app;
}

/** Пул отвечает: документ есть; занятие прочтения удаётся или нет по флагу. */
function serve({ claimed }: { claimed: boolean }) {
  const seen: string[] = [];
  mockQuery.mockImplementation(async (sql: string) => {
    seen.push(sql);
    if (/SELECT[\s\S]*FROM qcontract_documents WHERE access_token/i.test(sql)) {
      return { rows: [DOC], rowCount: 1 };
    }
    if (/UPDATE qcontract_documents[\s\S]*view_count \+ 1/i.test(sql)) {
      return claimed ? { rows: [{ view_count: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  return seen;
}

describe("QContract: прочтение занимается атомарно", () => {
  beforeEach(() => mockQuery.mockReset());

  test("когда прочтение досталось — отдаёт содержимое и счётчик из базы", async () => {
    serve({ claimed: true });
    const res = await request(makeApp()).post("/api/qcontract/view/tok").send({});
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("секретное содержимое");
    // Номер прочтения — из RETURNING, а не «то, что было в SELECT, плюс один».
    expect(res.body.viewCount).toBe(1);
    expect(res.body.selfDestructed).toBe(true);
  });

  test("когда последнее прочтение забрал другой — 410 и БЕЗ содержимого", async () => {
    serve({ claimed: false });
    const res = await request(makeApp()).post("/api/qcontract/view/tok").send({});
    expect(res.status).toBe(410);
    expect(res.body.error).toBe("document_expired");
    // Главное: содержимое не должно просочиться проигравшему гонку.
    expect(res.body.content).toBeUndefined();
  });

  test("проигравшая гонка не пишет просмотр в журнал", async () => {
    const seen = serve({ claimed: false });
    await request(makeApp()).post("/api/qcontract/view/tok").send({});
    const inserts = seen.filter((s) => /INSERT INTO qcontract_views/i.test(s));
    expect(inserts).toEqual([]);
  });

  test("условие сгорания стоит в САМОМ запросе, а не в коде до него", async () => {
    const seen = serve({ claimed: true });
    await request(makeApp()).post("/api/qcontract/view/tok").send({});
    const claim = seen.find((s) => /UPDATE qcontract_documents[\s\S]*view_count \+ 1/i.test(s)) ?? "";
    // Без этого условия UPDATE снова стал бы безусловным, и гонка вернулась бы.
    expect(claim).toMatch(/view_count\s*<\s*max_views/i);
  });
});
