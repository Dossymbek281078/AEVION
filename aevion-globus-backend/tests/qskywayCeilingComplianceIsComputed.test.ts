import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Доля маршрутов, укладывающихся в потолок регулятора, считается, а не заявляется.
 *
 * ПОВОД (29.08.2026, мутационный аудит). Подмена `compliantPct` на 100
 * проходила НЕЗАМЕЧЕННОЙ, хотя меняет поведение: у Нью-Йорка настоящее
 * значение — **14%** (6 пар из 42). Страница показала бы, что в
 * опубликованный потолок укладывается ВСЁ.
 *
 * Это заявление о соответствии регулятору — самое дорогое, что модуль может
 * сказать неверно: остальные числа врут о качестве данных, это — о том,
 * законно ли полетит корридор.
 *
 * Тест считает долю САМ из compliant и pairs. Сверять поле с самим собой
 * («pct равен pct») не имеет смысла; проверяется вывод из слагаемых.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("доля соответствия потолку выводится из слагаемых", () => {
  test("compliantPct пересчитывается из compliant и pairs", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    expect(res.status).toBe(200);
    expect(res.body.available, "у nyc должна быть сетка потолков").toBe(true);
    const { compliant, pairs, compliantPct } = res.body;
    expect(typeof compliant).toBe("number");
    expect(typeof pairs).toBe("number");
    const mine = Math.round((100 * compliant) / Math.max(1, pairs));
    expect(compliantPct, "доля не выводится из своих же слагаемых").toBe(mine);
  });

  test("🔴 доля НЕ равна ста, пока compliant меньше pairs", async () => {
    // Отрицательный контроль и он же суть проверки: без него подмена «всегда
    // 100» неотличима от правды на городе, где и так всё соответствует.
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    const { compliant, pairs, compliantPct } = res.body;
    expect(pairs, "пар нет — проверять нечего").toBeGreaterThan(0);
    expect(compliant, "все пары соответствуют — проверка не различает 100 и правду").toBeLessThan(pairs);
    expect(compliantPct, "объявлено полное соответствие при неполном").toBeLessThan(100);
  });

  test("числа согласованы между собой", async () => {
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    const { compliant, routable, pairs, strictRoutable } = res.body;
    expect(compliant).toBeLessThanOrEqual(routable);
    expect(routable).toBeLessThanOrEqual(pairs);
    expect(strictRoutable).toBeLessThanOrEqual(pairs);
    expect(compliant).toBeGreaterThanOrEqual(0);
  });

  test("🔴 строгий режим НЕ пропускает все пары, пока есть превышения", async () => {
    // Мутация «strictRoutable: pairs, worstExceedanceM: 0» проходила
    // незамеченной, хотя настоящие значения — 20 из 42 и 166 м. Вместе они
    // говорят одно: включи строгое соблюдение потолка, и треть маршрутов
    // перестанет существовать. Объявить обратное — сказать, что регулятор
    // ничему не мешает.
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    const { strictRoutable, pairs, worstExceedanceM, compliant } = res.body;
    expect(typeof strictRoutable).toBe("number");
    expect(typeof worstExceedanceM).toBe("number");
    // Пары, не уложившиеся в потолок, ЕСТЬ — иначе проверка ниже слепа.
    expect(compliant, "все пары соответствуют — проверка не различает").toBeLessThan(pairs);
    expect(
      strictRoutable,
      "в строгом режиме летают все пары, хотя часть не укладывается в потолок",
    ).toBeLessThan(pairs);
    expect(
      worstExceedanceM,
      "превышений нет, хотя часть пар не соответствует потолку",
    ).toBeGreaterThan(0);
  });

  test("строгий режим не строже, чем соответствие", async () => {
    // Пара, уложившаяся в потолок, обязана оставаться летабельной строго:
    // иначе одно из двух чисел считается не тем, чем названо.
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    expect(res.body.strictRoutable).toBeGreaterThanOrEqual(res.body.compliant);
  });

  test("🔴 ограничения регулятора не обнуляются", async () => {
    // Шестая дыра аудита. Подмена «padsNeedingAtc: 0, zeroCeilingCells: 0»
    // проходила незамеченной, хотя настоящие значения — 1 и 2520.
    //
    // Оба числа говорят о том, чего регулятор НЕ разрешает: площадка, откуда
    // без согласования с диспетчером не взлететь, и ячейки с нулевым потолком.
    // Обнулить их — сказать, что над городом нет ни одного ограничения.
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=nyc");
    expect(typeof res.body.padsNeedingAtc).toBe("number");
    expect(typeof res.body.zeroCeilingCells).toBe("number");
    expect(
      res.body.zeroCeilingCells,
      "ни одной ячейки с нулевым потолком — регулятор ничего не запрещает?",
    ).toBeGreaterThan(0);
    expect(
      res.body.padsNeedingAtc,
      "ни одной площадки с согласованием — проверка не различает ноль и правду",
    ).toBeGreaterThan(0);
  });

  test("город без сетки не выдаёт долю соответствия", async () => {
    // Нечему соответствовать — значит и процента быть не должно, иначе он
    // читается как «всё в порядке».
    const res = await request(app()).get("/api/qskyway/airspace/impact?city=astana");
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.compliantPct, "доля выдана там, где потолков нет").toBeUndefined();
  });
});
