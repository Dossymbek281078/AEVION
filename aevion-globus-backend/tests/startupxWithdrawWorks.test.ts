import { describe, test, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import { startupExchangeRouter } from "../src/routes/startupExchange";
import { __resetStartupExchangeDbState } from "../src/lib/ensureStartupExchangeTables";

/**
 * Отзыв заявки работает — и только своим токеном.
 *
 * Ради этой ручки и сводилась ветка биржи: ежедневная проверка ходит той же
 * дверью и убирает за собой, вместо того чтобы каждую ночь оставлять в
 * публичной ленте ещё одну строку. Замер 29.08.2026 на проде: 19 записей,
 * 18 из них — наши смоук-заявки, и ручки отзыва там НЕТ (route_not_found).
 *
 * Ручка приезжает выкаткой — значит перед выкаткой надо знать, что она
 * работает, а не что она существует. Тестами она покрыта не была.
 */
const listing = (title: string) => ({
  title,
  description:
    "Описание достаточной длины для уровня «Только идея»: нужно не менее ста " +
    "двадцати символов, и здесь их заведомо больше, с запасом на порог.",
  tier: "idea",
  deal: { intent: "raise", askUsd: 50000, equityOfferedPct: 10 },
});

describe("отзыв заявки", () => {
  beforeEach(() => { __resetStartupExchangeDbState(); });

  const app = () => {
    const a = express();
    a.use(express.json());
    a.use("/api/startupx", startupExchangeRouter);
    return a;
  };

  test("своим токеном — заявка уходит из публичной ленты", async () => {
    const srv = app();
    const made = await request(srv).post("/api/startupx/ideas").send(listing("Заявка на отзыв"));
    expect(made.status, JSON.stringify(made.body).slice(0, 160)).toBe(201);
    const d = made.body?.data ?? made.body;
    const id = d.id;
    const token = d.manageToken;
    expect(token, "ответ не выдал токен управления — отозвать будет нечем").toBeTruthy();

    const before = await request(srv).get("/api/startupx/ideas?limit=200");
    const listBefore = (before.body?.data ?? before.body).listings ?? [];
    expect(listBefore.some((i: { id: number }) => i.id === id), "заявки нет в ленте").toBe(true);

    const gone = await request(srv).delete(`/api/startupx/ideas/${id}?token=${token}`);
    expect(gone.status, JSON.stringify(gone.body).slice(0, 160)).toBe(200);

    const after = await request(srv).get("/api/startupx/ideas?limit=200");
    const listAfter = (after.body?.data ?? after.body).listings ?? [];
    expect(
      listAfter.some((i: { id: number }) => i.id === id),
      "заявка осталась в публичной ленте после отзыва",
    ).toBe(false);
  });

  test("чужим токеном — отказ, заявка на месте", async () => {
    const srv = app();
    const made = await request(srv).post("/api/startupx/ideas").send(listing("Заявка чужая"));
    const id = (made.body?.data ?? made.body).id;

    const denied = await request(srv).delete(`/api/startupx/ideas/${id}?token=ne-tot-token`);
    // Отказ у ручки 401, а не 403 — проверено ответом, а не ожиданием.
    expect(denied.status, "чужой токен принят — отозвать смог бы любой").toBe(401);

    const after = await request(srv).get("/api/startupx/ideas?limit=200");
    const listAfter = (after.body?.data ?? after.body).listings ?? [];
    expect(listAfter.some((i: { id: number }) => i.id === id), "заявка исчезла от чужого токена").toBe(true);
  });
});
