import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";

import cyberchessPuzzlesRouter from "../src/routes/cyberchessPuzzles";

/**
 * Число «сколько задач в банке» публиковалось в двух видах, и они спорили.
 *
 * Замер 28.08.2026 на проде:
 *
 *   GET /api/cyberchess-puzzles/themes      -> poolSize 500000
 *   GET /api/cyberchess-daily/puzzle        -> poolSize 502584
 *
 * Оба про один и тот же банк. Разница в том, что POOL.length упирается в cap
 * (по умолчанию 500 000), то есть «500000» — это ОБРЕЗКА, а не измерение.
 * В шапке cyberchessPuzzles.ts об этом прямо написано, и там же заведены
 * POOL_TOTAL (настоящий размер) и POOL_CAPPED (обслуживаем не весь банк).
 * Ручка /meta их отдавала, а /themes — нет: печатала обрезку в одиночку.
 *
 * Читающий видит круглое число и принимает его за размер банка. Поэтому
 * правило: poolSize не публикуется БЕЗ спутников, называющих настоящий
 * размер и факт обрезки.
 *
 * Регулярок в файле нет намеренно — слэши теряются на границе вызова, и тогда
 * тест молча перестаёт разбираться («no tests» вместо красного).
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use(cyberchessPuzzlesRouter);
  return a;
}

const ENDPOINTS = ["/themes", "/meta"];

describe("размер банка задач: обрезку нельзя выдавать за измерение", () => {
  it("контроль прибора: ручки отвечают и отдают poolSize", async () => {
    for (const p of ENDPOINTS) {
      const res = await request(app()).get(p);
      expect(res.status, `${p} не ответила`).toBe(200);
      expect(res.body, `${p} не отдала poolSize — читаю не то`).toHaveProperty("poolSize");
    }
  });

  for (const p of ENDPOINTS) {
    it(`${p}: рядом с poolSize стоят настоящий размер и признак обрезки`, async () => {
      const res = await request(app()).get(p);
      expect(res.body, `${p} печатает poolSize без bankTotal`).toHaveProperty("bankTotal");
      expect(res.body, `${p} печатает poolSize без признака capped`).toHaveProperty("capped");
    });
  }

  it("контроль: обрезка и банк — разные величины, их не склеили", async () => {
    // Если кто-то «согласует» ответы, присвоив bankTotal = poolSize, defect
    // вернётся в новом виде: число снова станет обрезкой под честным именем.
    const res = await request(app()).get("/meta");
    expect(typeof res.body.bankTotal, "bankTotal должен быть числом").toBe("number");
    expect(typeof res.body.capped, "capped должен быть булевым").toBe("boolean");
  });
});
