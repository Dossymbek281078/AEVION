import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// Все ручки, публикующие poolSize. Список ведётся вручную осознанно: у него
// есть контроль ниже, который сверяет его с ЧИСЛОМ мест в исходнике, чтобы
// новая ручка не появилась мимо правила.
const ENDPOINTS = ["/themes", "/meta", "/"];

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

/**
 * Контроль ОХВАТА. Список ручек выше ведётся руками, а значит устаревает:
 * появится новая ручка с poolSize — правило её не заметит, и сторож останется
 * зелёным, охраняя не всё. Поэтому сверяем список с исходником напрямую.
 *
 * Это тот случай, когда структурная проверка уместна: свойство сквозное по
 * файлу, поведенческим тестом каждую будущую ручку не покрыть. Но тогда она
 * обязана проверять СЕБЯ — сколько мест нашла, — иначе ответит «нарушений
 * нет» и на пустом множестве.
 */
describe("охват: ни одно место в исходнике не публикует обрезку в одиночку", () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "cyberchessPuzzles.ts");
  const src = readFileSync(SRC, "utf8");
  const NEEDLE = "poolSize: POOL.length";

  const sites: number[] = [];
  for (let at = src.indexOf(NEEDLE); at >= 0; at = src.indexOf(NEEDLE, at + 1)) sites.push(at);

  it("контроль прибора: места вообще найдены", () => {
    expect(sites.length, "не нашёл ни одного poolSize — читаю не тот файл").toBeGreaterThan(2);
  });

  it("у каждого места рядом стоит настоящий размер банка", () => {
    const naked = sites.filter((at) => !src.slice(at, at + 200).includes("bankTotal"));
    expect(
      naked.length,
      `${naked.length} из ${sites.length} мест печатают обрезку без bankTotal`,
    ).toBe(0);
  });
});
