import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Подписанный документ называет качество высот, а не только воздушное правило.
 *
 * ПОВОД. 28.08.2026 прочитал готовый документ глазами того, кто понесёт его
 * регулятору. `scope` объяснял воздушное ограничение честно — вплоть до того,
 * что документ «служит основанием НЕ для полёта». А про высоты молчал, хотя
 * в полях рядом лежало `heightConfidencePct: 82` и тут же
 * `measuredObstacleSegments: 0` из `obstacleSegments: 20`.
 *
 * Одно число успокаивает, другое тревожит, и они об одном и том же: общий
 * процент считается по ВСЕМ участкам, включая открытую землю, и потому
 * разбавлен. Без оговорки «82%» читается как «данные хорошие».
 *
 * Проверка НЕ требует конкретной формулировки — только чтобы обе цифры,
 * которые видит регулятор, были названы вслух там же, где он читает границы.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("scope документа называет качество высот", () => {
  test("маршрут со зданиями под крылом: оговорка есть и числа сходятся", async () => {
    const res = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    expect(res.status).toBe(200);

    const doc = res.body?.document ?? {};
    const obstacle = Number(doc.obstacleSegments ?? 0);
    // Контроль прибора: если под крылом зданий нет, говорить не о чем, и
    // «оговорки нет» будет верным ответом — но тогда и проверка ничего не
    // проверила. Требуем случай, в котором она применима.
    expect(obstacle, "на этой паре нет участков со зданием — проверка неприменима").toBeGreaterThan(0);
    const measured = Number(doc.measuredObstacleSegments ?? 0);
    expect(measured, "все высоты обмерены — оговорка не нужна, обновите пару").toBeLessThan(obstacle);

    const scope = String(res.body?.scope ?? "");
    const scopeEn = String(res.body?.scopeEn ?? "");
    // Оба числа регулятора обязаны прозвучать в тексте, а не только в полях.
    expect(scope, "в scope нет числа участков со зданием").toContain(String(obstacle));
    expect(scope, "в scope нет числа обмеренных").toContain(String(measured));
    // И главное: сказано, что общий процент считается по ВСЕМ участкам.
    expect(scope.includes("по ВСЕМ участкам"), "разбавленность общего процента не названа").toBe(true);
    expect(scopeEn.includes("ALL segments"), "то же по-английски не сказано").toBe(true);

    // Воздушная часть НЕ должна пропасть: оговорка дописывается, а не заменяет.
    expect(scope.length, "воздушная часть исчезла").toBeGreaterThan(200);
  });
});
