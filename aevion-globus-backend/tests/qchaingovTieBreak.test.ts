import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Подсчёт итога решал ничью молча и по-разному в двух местах:
 *
 *  - в режиме «да/нет» равенство весов отдавало победу варианту «no»
 *    (`yesWeight > noWeight ? "yes" : (noWeight > 0 ? "no" : null)`);
 *  - в остальных режимах побеждал вариант, который база вернула ПЕРВЫМ:
 *    `for (const row of tally) if (row.weight > topWeight) …`, а порядок строк
 *    в `GROUP BY` стандартом не определён. То есть один и тот же расклад
 *    голосов мог дать разный ответ.
 *
 * Для модуля голосований это не мелочь: «победил тот, кто оказался первым в
 * выдаче» — это отсутствие правила, а не правило.
 *
 * Теперь ничья называется ничьёй (`tie: true`, победителя нет либо он выбран
 * ЯВНЫМ правилом — порядок вариантов у автора, затем алфавит).
 */

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

// Список админов читается из окружения ВНУТРИ обработчика, но выставляем его
// через vi.hoisted — до импорта роутера: правило из прошлого разбоя, когда
// `process.env` в теле теста опаздывал за связыванием модуля на импорте.
vi.hoisted(() => {
  process.env.QCHAINGOV_ADMIN_EMAILS = "a@test.aev";
});

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

const ADMIN = `Bearer ${signJwt({ sub: "admin-1", email: "a@test.aev", role: "ADMIN" })}`;

type Tally = { choice: string; votes: number; weight: number }[];

/** Пул: закрытое предложение + заданный расклад голосов. */
function serve(opts: { voteMode: string; options: string[]; tally: Tally; passThreshold?: number }) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const q = String(sql);
    if (q.includes('FROM "QChainGovProposal"') && q.includes("LIMIT 1")) {
      return {
        rows: [
          {
            id: "p1",
            voteMode: opts.voteMode,
            options: opts.options,
            quorumPercent: 1,
            passThreshold: opts.passThreshold ?? 60,
            authorUserId: "author",
            status: "closed",
          },
        ],
        rowCount: 1,
      };
    }
    if (q.includes('FROM "QChainGovVote"') && q.includes("GROUP BY")) {
      return { rows: opts.tally, rowCount: opts.tally.length };
    }
    if (q.includes('UPDATE "QChainGovProposal"')) {
      return { rows: [{ id: "p1", status: "closed", executedAt: new Date() }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

const execute = () =>
  request(makeApp()).post("/api/qchaingov/proposals/p1/execute").set("Authorization", ADMIN).send({});

describe("QChainGov: ничья не превращается в победу молча", () => {
  beforeEach(() => mockQuery.mockReset());

  test("да/нет поровну — победителя нет, ничья названа", async () => {
    serve({
      voteMode: "yes-no-abstain",
      options: ["yes", "no", "abstain"],
      tally: [
        { choice: "yes", votes: 3, weight: 3 },
        { choice: "no", votes: 3, weight: 3 },
      ],
    });
    const res = await execute();
    expect(res.status).toBe(200);
    expect(res.body.winningChoice).toBeNull(); // раньше здесь было "no"
    expect(res.body.tie).toBe(true);
    expect(res.body.status).toBe("rejected");
  });

  test("да/нет с перевесом — победитель называется", async () => {
    serve({
      voteMode: "yes-no-abstain",
      options: ["yes", "no"],
      tally: [
        { choice: "yes", votes: 4, weight: 4 },
        { choice: "no", votes: 1, weight: 1 },
      ],
    });
    const res = await execute();
    expect(res.body.winningChoice).toBe("yes");
    expect(res.body.tie).toBe(false);
    expect(res.body.status).toBe("executed");
  });

  test("равные веса в weighted — победитель по порядку вариантов автора, а не по порядку строк", async () => {
    const options = ["alpha", "beta"];
    // база возвращает «beta» первой — раньше она и побеждала
    serve({
      voteMode: "weighted",
      options,
      tally: [
        { choice: "beta", votes: 2, weight: 2 },
        { choice: "alpha", votes: 2, weight: 2 },
      ],
    });
    const res = await execute();
    expect(res.body.winningChoice).toBe("alpha"); // первый в списке автора
    expect(res.body.tie).toBe(true);
  });

  test("тот же расклад в обратном порядке строк даёт ТОТ ЖЕ ответ", async () => {
    const options = ["alpha", "beta"];
    serve({
      voteMode: "weighted",
      options,
      tally: [
        { choice: "alpha", votes: 2, weight: 2 },
        { choice: "beta", votes: 2, weight: 2 },
      ],
    });
    const res = await execute();
    expect(res.body.winningChoice).toBe("alpha");
    expect(res.body.tie).toBe(true);
  });

  test("нет голосов вовсе — победителя нет и ничьи нет", async () => {
    serve({ voteMode: "weighted", options: ["alpha", "beta"], tally: [] });
    const res = await execute();
    expect(res.body.winningChoice).toBeNull();
    expect(res.body.tie).toBe(false);
    expect(res.body.status).toBe("rejected");
  });

  test("явный перевес в weighted — ничьи нет", async () => {
    serve({
      voteMode: "weighted",
      options: ["alpha", "beta"],
      tally: [
        { choice: "alpha", votes: 5, weight: 5 },
        { choice: "beta", votes: 1, weight: 1 },
      ],
    });
    const res = await execute();
    expect(res.body.winningChoice).toBe("alpha");
    expect(res.body.tie).toBe(false);
  });
});
