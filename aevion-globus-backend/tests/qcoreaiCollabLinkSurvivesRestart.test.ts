import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Ссылка совместного просмотра переживает перезапуск процесса.
 *
 * Замер 28.08.2026: токен жил ТОЛЬКО в карте памяти, а ответ обещал срок
 * действия 24 часа. Прод пересоздаётся при каждой выкатке, их несколько в
 * день — значит человек отправлял коллеге ссылку, та через час-другой
 * отвечала "collab link not found or expired", и виноватым выглядел коллега.
 *
 * Таблица "QCoreSessionInvite" под это уже существовала и не использовалась.
 *
 * Перезапуск здесь настоящий, а не на словах: карта памяти теста пуста с
 * самого начала, и ответ обязан прийти из базы. Если обработчик снова начнёт
 * читать память, тест покраснеет — проверено мутацией.
 */

type Invite = {
  token: string; sessionId: string; invitedBy: string; role: string;
  usedCount: number; createdAt: string; expiresAt: string | null;
};
const invites: Invite[] = [];

const val = (p: unknown[] | undefined, i: number) => String(p?.[i] ?? "");

// Стенд исполняет присланный запрос, а не подменяет его собственным решением:
// стенд, который сам решает, что вернуть, зелен и на сломанном коде.
vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      if (!s.includes("QCoreSessionInvite")) {
        const head = s.trimStart().toUpperCase();
        if (head.startsWith("SELECT") && s.includes("QCoreSession")) {
          // Сама сессия существует и принадлежит владельцу ссылки.
          return { rows: [{ id: "s1", userId: "owner", title: "Разбор", createdAt: new Date().toISOString() }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (s.trimStart().toUpperCase().startsWith("INSERT")) {
        invites.push({
          token: val(params, 3), sessionId: val(params, 1), invitedBy: val(params, 2),
          role: "collab", usedCount: 0, createdAt: new Date().toISOString(),
          expiresAt: val(params, 4) || null,
        });
        return { rows: [], rowCount: 1 };
      }

      // Срок действия и приращение счётчика берём ИЗ ЗАПРОСА, а не из своих
      // представлений: стенд, который проверяет срок всегда, остаётся зелёным
      // и когда обработчик перестал его проверять.
      const checksExpiry = s.includes('"expiresAt" > NOW()');
      const alive = (r: Invite) =>
        !checksExpiry || !r.expiresAt || new Date(r.expiresAt).getTime() > Date.now();

      if (s.trimStart().toUpperCase().startsWith("UPDATE")) {
        const r = invites.find((x) => x.token === val(params, 0) && x.role === "collab" && alive(x));
        if (!r) return { rows: [], rowCount: 0 };
        if (s.includes('"usedCount" + 1')) r.usedCount += 1;
        return { rows: [{ ...r }], rowCount: 1 };
      }

      if (s.trimStart().toUpperCase().startsWith("DELETE")) {
        // Условие по ВЛАДЕЛЬЦУ берём ИЗ ЗАПРОСА. Стенд, который фильтрует по
        // владельцу всегда, остаётся зелёным и когда обработчик про владельца
        // забыл, — то есть охраняет право, которого в коде уже нет.
        const byOwner = s.includes('"invitedBy" = $2');
        const before = invites.length;
        for (let i = invites.length - 1; i >= 0; i--) {
          const x = invites[i];
          if (x.sessionId === val(params, 0) && (!byOwner || x.invitedBy === val(params, 1)) && x.role === "collab") {
            invites.splice(i, 1);
          }
        }
        return { rows: [], rowCount: before - invites.length };
      }

      // Сводка.
      const mine = invites.filter((x) => x.sessionId === val(params, 0) && x.role === "collab" && alive(x));
      return {
        rows: [{
          total: mine.reduce((a, b) => a + b.usedCount, 0),
          last: mine.reduce((a, b) => Math.max(a, b.usedCount), 0),
          created: mine.length ? mine[0].createdAt : null,
        }],
        rowCount: 1,
      };
    },
  }),
}));

vi.mock("../src/lib/ensureQCoreTables", () => ({
  ensureQCoreTables: async () => {},
  isDbReady: () => true,
  getDbError: () => null,
}));

vi.mock("../src/lib/authJwt", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, verifyBearerOptional: () => ({ sub: "owner" }) };
});

import { qcoreaiRouter } from "../src/routes/qcoreai";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qcoreaiRouter);
  return a;
}

describe("ссылка совместного просмотра QCoreAI живёт в базе", () => {
  test("создание кладёт ссылку в базу, а не в память процесса", async () => {
    const res = await request(app()).post("/x/sessions/s1/collab").send({});
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.token, "токен не выдан").toBeTruthy();
    expect(invites.length, "ссылка не сохранена — переживёт только этот процесс").toBe(1);
    expect(invites[0].sessionId).toBe("s1");
  });

  test("после перезапуска ссылка открывается: память пуста, база помнит", async () => {
    const token = invites[0].token;
    const res = await request(app()).get(`/x/collab/${token}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.viewers, "просмотр не засчитан").toBe(1);
  });

  test("счётчик просмотров тоже переживает перезапуск", async () => {
    const token = invites[0].token;
    await request(app()).get(`/x/collab/${token}`);
    const res = await request(app()).get(`/x/collab/${token}`);
    expect(res.body.viewers, "счётчик считает не по базе").toBe(3);
  });

  test("сводка владельца берёт числа из базы", async () => {
    const res = await request(app()).get("/x/sessions/s1/collab/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalViews, "сводка не видит просмотров из базы").toBe(3);
  });

  test("выдуманный токен — 404, а не пустой успех", async () => {
    const res = await request(app()).get("/x/collab/deadbeefdeadbeef");
    expect(res.status).toBe(404);
  });

  test("просроченная ссылка не открывается", async () => {
    invites.push({
      token: "expiredtoken", sessionId: "s1", invitedBy: "owner", role: "collab",
      usedCount: 0, createdAt: new Date(Date.now() - 90_000_000).toISOString(),
      expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    const res = await request(app()).get("/x/collab/expiredtoken");
    expect(res.status, "ссылка с истёкшим сроком всё ещё открывается").toBe(404);
    invites.splice(invites.findIndex((x) => x.token === "expiredtoken"), 1);
  });

  test("отзыв убирает СВОЮ ссылку и не трогает чужую", async () => {
    // Без этой чужой строки проверка не отличала бы «отозвал своё» от
    // «отозвал всё, что нашлось по sessionId»: мутация, снявшая условие по
    // владельцу, проходила молча.
    invites.push({
      token: "someoneelse", sessionId: "s1", invitedBy: "other-owner", role: "collab",
      usedCount: 0, createdAt: new Date().toISOString(), expiresAt: null,
    });
    const token = invites[0].token;
    const del = await request(app()).delete("/x/sessions/s1/collab");
    expect(del.status).toBe(200);
    expect(del.body.revoked, "отозвано не ровно своё").toBe(1);
    expect(
      invites.some((x) => x.token === "someoneelse"),
      "отозвана ЧУЖАЯ ссылка на ту же сессию",
    ).toBe(true);
    const after = await request(app()).get(`/x/collab/${token}`);
    expect(after.status, "отозванная ссылка всё ещё открывается").toBe(404);
  });
});
