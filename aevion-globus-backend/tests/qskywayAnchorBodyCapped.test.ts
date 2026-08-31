import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { bodyLimitByPath, BODY_LIMITS } from "../src/lib/bodyLimitByPath";
import { makeHttpErrorHandler } from "../src/lib/httpErrorHandler";

/**
 * Крупное тело отбивается ДО обработчика, а не в нём.
 *
 * ПОВОД. Обработчик проверки якоря уже отбивал доказательства крупнее 64 КБ и
 * объяснял почему: «разбирать такое, прежде чем понять негодность, — работа,
 * которую выбирает атакующий». Но проверка стояла В ОБРАБОТЧИКЕ — то есть
 * после разбора десяти мегабайт общего предела. Намерение было названо, а
 * исполнено наполовину; механизм `BODY_LIMITS` лежал рядом всё это время.
 *
 * Проверяем не код ответа, а ДОШЛО ЛИ ДО ОБРАБОТЧИКА. Код 413 можно получить и
 * из самого обработчика — тогда тело уже разобрано, и защита декоративна.
 */
const PATH = "/api/qskyway/airspace/anchor/verify";

function app(reached: { count: number }) {
  const a = express();
  a.use(bodyLimitByPath);
  a.use(express.json({ limit: "10mb" }));
  a.post(PATH, (_req, res) => {
    reached.count += 1;
    res.json({ ok: true });
  });
  a.use(makeHttpErrorHandler(() => {}));
  return a;
}

describe("проверка якоря: крупное тело не доходит до разбора", () => {
  test("предел зарегистрирован и он НЕ общий десятимегабайтный", () => {
    const limit = BODY_LIMITS[PATH];
    expect(limit, "путь не зарегистрирован в BODY_LIMITS").toBeGreaterThan(0);
    expect(limit, "предел не меньше общего — значит его нет").toBeLessThan(10 * 1024 * 1024);
    // И не настолько тесный, чтобы отбить настоящее доказательство: наш .ots с
    // Bitcoin-подтверждением — 3.7 КБ.
    expect(limit).toBeGreaterThanOrEqual(64 * 1024);
  });

  test("тело сверх предела: 413 И обработчик НЕ вызван", async () => {
    const reached = { count: 0 };
    const big = "A".repeat(200 * 1024);
    const res = await request(app(reached))
      .post(PATH)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ otsProofB64: big }));
    expect(res.status).toBe(413);
    expect(reached.count, "тело всё-таки разобрали и дошли до обработчика").toBe(0);
  });

  test("обычное тело проходит — предел не мешает работе", async () => {
    const reached = { count: 0 };
    const res = await request(app(reached))
      .post(PATH)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ otsProofB64: "A".repeat(4 * 1024) }));
    expect(res.status).toBe(200);
    expect(reached.count).toBe(1);
  });
});
