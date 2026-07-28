import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * `GET /proposals/:id` — ручка публичная, входа не требует — читала предложение
 * запросом `SELECT *` и отдавала строку целиком. Соседний список предложений
 * строкой выше поля как раз перечисляет: два места одного модуля расходились.
 *
 * Опасность «выбрать всё» не в том, что оно отдаёт сегодня, а в том, что объём
 * выдачи растёт сам: колонку добавили обычным обновлением базы — и она уехала
 * наружу, никто ничего не менял в коде. Ровно так это и случилось в двух других
 * модулях платформы за сегодня.
 *
 * Тест держит инвариант в обе стороны: нужные поля отдаются, ЛИШНИЕ — нет,
 * даже если база вернёт их в строке.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qchaingovRouter } from "../src/routes/qchaingov";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qchaingov", qchaingovRouter);
  return app;
}

/** Колонки, которые вернул бы `SELECT *` завтра: к нынешним добавлены новые. */
const ROW_FROM_DB = {
  id: "p1",
  authorUserId: "author-1",
  title: "Предложение",
  summary: "Кратко",
  body: "Полный текст",
  category: "platform",
  voteMode: "yes-no-abstain",
  options: ["yes", "no"],
  quorumPercent: 10,
  passThreshold: 60,
  status: "open",
  votesOpenAt: null,
  votesCloseAt: null,
  executedAt: null,
  createdAt: new Date().toISOString(),
  // ↓ колонки, которых сегодня в схеме нет: так выглядит завтрашнее обновление
  internalRiskScore: 0.87,
  moderatorNote: "автор на карандаше",
};

describe("QChainGov: публичная выдача предложения отдаёт только перечисленное", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string) => {
      const q = String(sql);
      if (q.includes('FROM "QChainGovProposal"') && q.includes("LIMIT 1")) {
        // База отдаёт ВСЁ, что у неё есть, — как это и делает `SELECT *`
        return { rows: [ROW_FROM_DB], rowCount: 1 };
      }
      if (q.includes("GROUP BY")) return { rows: [], rowCount: 0 };
      return { rows: [{ total: 0, total_weight: 0 }], rowCount: 1 };
    });
  });

  test("запрос перечисляет поля, а не берёт всё подряд", async () => {
    await request(makeApp()).get("/api/qchaingov/proposals/p1");
    const select = mockQuery.mock.calls
      .map((c) => String(c[0]))
      .find((q) => q.includes('FROM "QChainGovProposal"') && q.includes("LIMIT 1"));

    expect(select, "запрос к предложению не найден").toBeTruthy();
    expect(select).not.toMatch(/SELECT\s+\*/i);
    expect(select).toContain('"title"');
    expect(select).toContain('"body"');
  });

  test("нужные поля на месте", async () => {
    const res = await request(makeApp()).get("/api/qchaingov/proposals/p1");
    expect(res.status).toBe(200);
    for (const k of ["id", "title", "summary", "body", "status", "options", "createdAt"]) {
      expect(res.body.proposal, `нет поля ${k}`).toHaveProperty(k);
    }
  });

  test("тело ответа не шире перечисленного списка", async () => {
    const res = await request(makeApp()).get("/api/qchaingov/proposals/p1");
    const allowed = new Set([
      "id", "authorUserId", "title", "summary", "body", "category", "voteMode", "options",
      "quorumPercent", "passThreshold", "status", "votesOpenAt", "votesCloseAt", "executedAt", "createdAt",
    ]);
    const extra = Object.keys(res.body.proposal).filter((k) => !allowed.has(k));
    // Здесь проверяется намерение: список полей задан явно, и если завтра
    // кто-то вернёт `SELECT *`, ответ станет шире — тест это покажет.
    expect(extra, `наружу ушли лишние поля: ${extra.join(", ")}`).toEqual([]);
  });
});

describe("GET /proposals/:id/votes — внутренний id голосующего наружу не уходит", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string) => {
      if (/FROM "QChainGovVote"/i.test(sql)) {
        return {
          rows: [
            {
              id: "v1",
              voterUserId: "user-42",
              choice: "yes",
              weight: 1,
              rationale: "по существу",
              createdAt: "2026-07-28T00:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  test("вместо voterUserId отдаётся псевдоним", async () => {
    const res = await request(makeApp()).get("/api/qchaingov/proposals/p1/votes");
    expect(res.status).toBe(200);
    const vote = res.body.votes[0];
    expect(vote).not.toHaveProperty("voterUserId");
    expect(JSON.stringify(res.body)).not.toContain("user-42");
    expect(vote.voter).toMatch(/^[0-9a-f]{12}$/);
    // Содержательные поля на месте — иначе «починка» превратила бы список в пустышку.
    expect(vote.choice).toBe("yes");
    expect(vote.rationale).toBe("по существу");
  });

  test("один человек в разных голосованиях — разные псевдонимы", async () => {
    const a = await request(makeApp()).get("/api/qchaingov/proposals/p1/votes");
    const b = await request(makeApp()).get("/api/qchaingov/proposals/p2/votes");
    expect(a.body.votes[0].voter).not.toBe(b.body.votes[0].voter);
  });
});
