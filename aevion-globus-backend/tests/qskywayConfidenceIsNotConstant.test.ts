import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * `heightConfidencePct` РАЗЛИЧАЕТ города, а не печатает константу.
 *
 * ПОВОД (29.08.2026). Мутационная проверка нашла у этого числа
 * одностороннюю защиту: `toBeGreaterThan(50)` — пол без потолка.
 *
 *   heightConfidencePct -> 3     поймана (ниже пола)
 *   heightConfidencePct -> 100   НЕ ПОЙМАНА
 *
 * Направление, которое проходило свободно, — ровно опасное. Это число
 * отчитывается, насколько высотам вообще можно верить; занижение
 * безобидно, а «обмерено 100 %» для города, где не обмерено НИ ОДНО
 * здание, — та самая лесть, ради которой второе число и заведено.
 *
 * Замер на живых данных: Астана 96 % при 0 обмеренных зданиях из 4,
 * Нью-Йорк 100 % при 37 из 37.
 *
 * ПОЧЕМУ ОТНОШЕНИЕ, А НЕ ЧИСЛО. Написать `toBeLessThan(100)` или
 * закрепить 96 значило бы наказать за прогресс: обмеряют Астану —
 * сторож краснеет на УЛУЧШЕНИИ. Отношение «город без городского обмера
 * не может быть увереннее города с полным обмером» переживает любое
 * улучшение данных и при этом убивает ЛЮБУЮ константу: она делает
 * города равными, а равенство здесь запрещено.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

async function measure(city: string) {
  const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city });
  expect(r.status, city + ": маршрут не построился, мерить нечего").toBe(200);
  return {
    pct: r.body.heightConfidencePct as number,
    obstacles: r.body.obstacleSegments as number,
    measured: r.body.measuredObstacleSegments as number,
  };
}

describe("уверенность по высотам зависит от данных города", () => {
  test("город без городского обмера не увереннее города с полным", async () => {
    const astana = await measure("astana");
    const nyc = await measure("nyc");

    // Отрицательный контроль. Без него отношение можно было бы
    // выполнить, обмерив оба города или ни одного, — и проверка стала
    // бы пустой, продолжая выглядеть осмысленной.
    expect(astana.obstacles, "в Астане нет участков со зданием — сравнивать нечего").toBeGreaterThan(0);
    expect(astana.measured, "у Астаны появился городской обмер — тест опирался на его отсутствие").toBe(0);
    expect(nyc.measured, "у Нью-Йорка пропал городской обмер — сравнение потеряло смысл").toBeGreaterThan(0);

    expect(
      astana.pct,
      "уверенность одинакова у города без обмера и города с полным обмером: " +
        "число не следует за данными (astana=" + astana.pct + ", nyc=" + nyc.pct + ")",
    ).toBeLessThan(nyc.pct);
  }, 60000);
});
