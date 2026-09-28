/**
 * «Оплачено ли» обязано спрашивать ОБА источника прав.
 *
 * ПОВОД (28.09.2026). Модуль открывается либо поштучной подпиской (строка
 * AppSubscription), либо платформенным тарифом; с 15.09 любой платный тариф
 * даёт всю платформу. А `/api/apps/access/check` — ручка, которой пользуется
 * гейт «Глубокий анализ» в шахматах, — смотрела только в таблицу поштучных
 * покупок. Значит подписчик Full получал active:false, замок «🔒 Открыть Pro»
 * и предложение заплатить второй раз за уже оплаченное.
 *
 * Канонический гейт requireModule спрашивает оба источника — то есть
 * расходились не права, а две двери в одну комнату.
 *
 * Здесь закрепляется поведение на всех четырёх исходах, включая «спросить не
 * удалось»: он обязан отличаться от «не куплено», иначе сбой базы выглядит как
 * отказ в доступе тому, кто заплатил.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const SECRET = "test-secret-two-sources";

let строкиПокупок: unknown[] = [];
let базаПадает = false;
let тарифПадает = false;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async () => {
      if (базаПадает) throw new Error("база недоступна");
      return { rows: строкиПокупок, rowCount: строкиПокупок.length };
    }),
  }),
}));
vi.mock("../src/lib/ensureAppSubscriptionTable", () => ({
  ensureAppSubscriptionTable: vi.fn(async () => {}),
}));
vi.mock("../src/lib/planGate", async () => {
  const реальный = await vi.importActual<typeof import("../src/lib/planGate")>("../src/lib/planGate");
  return {
    ...реальный,
    resolveUserPlan: (req: any) => {
      if (тарифПадает) throw new Error("хранилище подписок недоступно");
      return реальный.resolveUserPlan(req);
    },
  };
});

const приложение = async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { appAccessRouter } = await import("../src/routes/appAccess");
  const a = express();
  a.use("/api/apps/access", appAccessRouter);
  return a;
};

const токен = (поля: Record<string, unknown>) =>
  jwt.sign(поля, SECRET, { algorithm: "HS256", expiresIn: "1h" });

const спросить = async (t?: string) => {
  const r = request(await приложение()).get("/api/apps/access/check?app=cyberchess");
  return t ? r.set("Authorization", `Bearer ${t}`) : r;
};

beforeEach(() => {
  строкиПокупок = [];
  базаПадает = false;
  тарифПадает = false;
});

describe("/check спрашивает оба источника прав", () => {
  it("подписчик тарифа получает доступ БЕЗ строки поштучной покупки", async () => {
    // Ровно тот случай, ради которого правка: строк покупок нет вовсе.
    const res = await спросить(токен({ email: "full@example.com", plan: "full" }));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.source).toBe("plan");
  });

  it("контроль: без тарифа и без покупки — честное «нет»", async () => {
    // Без этого контроля первая проверка прошла бы и у ручки,
    // которая отвечает «да» всем подряд.
    const res = await спросить(токен({ email: "free@example.com" }));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it("поштучная покупка по-прежнему открывает — прежний путь не сломан", async () => {
    строкиПокупок = [{ x: 1 }];
    const res = await спросить(токен({ email: "buyer@example.com" }));
    expect(res.body.active).toBe(true);
    expect(res.body.source).toBe("app");
  });

  it("база упала, а тариф прав не дал — 500, а НЕ «не куплено»", async () => {
    базаПадает = true;
    const res = await спросить(токен({ email: "free@example.com" }));
    expect(res.status).toBe(500);
    expect(res.body.active).toBeUndefined();
  });

  it("тариф не прочитан и покупки нет — 503 «не знаю», а НЕ «не куплено»", async () => {
    тарифПадает = true;
    const res = await спросить(токен({ email: "free@example.com" }));
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("entitlement_check_failed");
    expect(res.body.active).toBeUndefined();
  });

  it("тариф не прочитан, но поштучная покупка есть — доступ даём", async () => {
    тарифПадает = true;
    строкиПокупок = [{ x: 1 }];
    const res = await спросить(токен({ email: "buyer@example.com" }));
    expect(res.body.active).toBe(true);
  });

  it("без токена — по-прежнему 401, чужие покупки не выдаются", async () => {
    const res = await спросить();
    expect(res.status).toBe(401);
  });
});
