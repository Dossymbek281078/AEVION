import { describe, expect, test } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ячеек без данных о потолке не может быть больше, чем ячеек всего.
 *
 * ПОВОД (29.08.2026, мутация в обе стороны). У `zeroCeilingCells` защита
 * оказалась односторонней:
 *
 *   zeroCeilingCells -> 0       поймана
 *   zeroCeilingCells -> 99999   НЕ поймана
 *
 * Любопытно, что закрыта здесь как раз ОПАСНАЯ сторона: ноль означал бы
 * «данные о потолках полны», то есть лесть. Открытой осталась безобидная
 * на первый взгляд — завышение.
 *
 * Но 99999 не просто «некрасиво»: оно ЛОГИЧЕСКИ НЕВОЗМОЖНО. Число
 * публикуется рядом с `gridCells`, и вместе они читаются как доля города
 * без регуляторных данных. Пара, где часть больше целого, разрушает
 * доверие ко всему ответу — а внешний проверяющий увидит именно пару.
 *
 * Инвариант выводится из самого ответа и не зависит от данных города,
 * поэтому не устареет при обновлении сетки.
 *
 * ⚠️ ЭТОТ сторож ловит только завышение. Занижение до нуля ловит ДРУГОЙ,
 * уже существующий (проверено мутацией: `-> 0` краснеет там, `-> 99999`
 * не краснел нигде). Вместе они закрывают обе стороны — по отдельности
 * ни один. Убирая один как «лишний», вы открываете половину.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("доля города без потолков арифметически возможна", () => {
  test.each(["astana", "nyc", "tokyo"])("[%s] пустых ячеек не больше, чем всего", async (city) => {
    const r = await request(app).get("/api/qskyway/airspace/impact?city=" + city);
    expect(r.status).toBe(200);

    const zero = r.body.zeroCeilingCells as number | undefined;
    const total = r.body.gridCells as number | undefined;
    if (typeof zero !== "number" || typeof total !== "number") {
      // У города без сетки полей может не быть вовсе — это законно, но
      // молча пропускать нельзя: иначе проверка тихо станет пустой для
      // ВСЕХ городов, оставаясь зелёной.
      expect(r.body.available, city + ": полей нет, хотя сетка объявлена").toBe(false);
      return;
    }

    expect(total, city + ": в сетке ноль ячеек — сравнивать не с чем").toBeGreaterThan(0);
    expect(
      zero,
      city + ": ячеек без потолка " + zero + " при " + total + " всего — часть больше целого",
    ).toBeLessThanOrEqual(total);
    expect(zero, city + ": отрицательное число ячеек").toBeGreaterThanOrEqual(0);
  }, 60000);
});
