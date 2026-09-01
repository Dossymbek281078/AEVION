import { describe, expect, test } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Сторожевое значение не уходит наружу под видом измерения.
 *
 * ПОВОД (29.08.2026). Расстояние до ближайшей запретной зоны считалось с
 * заглушкой 9999, когда зон в городе нет вовсе, и в ЭТОМ ЖЕ виде уезжало
 * в ответ: `distNoFlyM: 9999`. Расчёту такое число нужно — это
 * «бесконечно далеко». Читателю ответа оно врёт: «до запрета 9999 метров»
 * выглядит как измерение.
 *
 * Страница знала про заглушку и показывала «далеко». Любой другой
 * читатель — смоук, регулятор, чужой клиент — принял бы за факт. Это тот
 * же класс, что весь остальной аудит окна: умолчание, выданное за замер.
 *
 * Починка: заглушка осталась ВНУТРИ расчёта, наружу уходит `null`.
 *
 * ⚠️ ГРАНИЦА, названная вслух. Сегодня у всех трёх городов по две зоны
 * (замер: astana 2, nyc 2, tokyo 2), поэтому ветка с `null` НЕ достижима
 * данными — прямо проверить её нельзя. Проверяю то, что проверяемо:
 * заглушка не появляется в ответе ни при каких обстоятельствах. Появится
 * город без зон — старый код отдал бы 9999, и этот сторож покраснеет.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

const SENTINEL = 9999;

describe("расстояние до запретной зоны — измерение или ничего", () => {
  test.each(["astana", "nyc", "tokyo"])("[%s] заглушка не уходит в ответ", async (city) => {
    const r = await request(app).get("/api/qskyway/city?city=" + city);
    expect(r.status).toBe(200);

    const scores = r.body.vertiportScores as { distNoFlyM: number | null }[];
    // Отрицательный контроль: пустой список дал бы ноль проверок и
    // зелёный результат — проверка, которой не было.
    expect(scores?.length, city + ": оценок площадок нет, проверять нечего").toBeGreaterThan(0);

    for (const s of scores) {
      if (s.distNoFlyM === null) continue;
      expect(typeof s.distNoFlyM, city + ": расстояние не число и не null").toBe("number");
      expect(
        s.distNoFlyM,
        city + ": в ответ ушла заглушка " + SENTINEL + " — читатель примет её за измерение",
      ).not.toBe(SENTINEL);
      expect(s.distNoFlyM, city + ": отрицательное расстояние").toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  test("город без зон отдал бы null, а не число", () => {
    // Достижимой данными эту ветку сделать нельзя, поэтому проверяю
    // САМО ПРАВИЛО в коде: публикуется `zones.length ? … : null`.
    // Проверка слабее поведенческой и названа таковой: она поймает
    // возврат к безусловной публикации числа, но не докажет поведение.
    const source = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../src/routes/qskyway.ts"),
      "utf8",
    ) as string;
    expect(
      source.includes("distNoFlyM: zones.length ? Math.round(distNoFly) : null"),
      "публикация расстояния перестала различать «нет зон» и «далеко»",
    ).toBe(true);
  });
});
