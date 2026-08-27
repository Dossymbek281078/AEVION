import { describe, test, expect } from "vitest";

import { __engineForTests } from "../src/routes/qskyway";

/**
 * `avoidsNoFly` называет свойство МАРШРУТА, а считалось по ГОРОДУ.
 *
 * До 27.08.2026 значение было `zones.length > 0` — «в этом городе вообще есть
 * запретные зоны». У всех трёх городов их по две, значит поле всегда отвечало
 * true и о конкретном коридоре не сообщало ничего. Хуже обратный случай: в
 * городе без зон оно ответило бы false, что читается как «этот коридор
 * запретные зоны НЕ обходит», хотя обходить нечего.
 *
 * Движок зоны обходит честно — врал только отчёт. Здесь закрепляется, что
 * теперь true означает написанное: прямая между площадками режет зону.
 */

const { directLineCrossesNoFly } = __engineForTests;

const A = { x: 0, y: 0 };
const B = { x: 1000, y: 0 };

describe("обход запретных зон: отчёт про маршрут, а не про город", () => {
  test("зона стоит на прямой — обход состоялся", () => {
    const zones = [{ x: 500, y: 0, radiusM: 100 }] as never[];
    expect(directLineCrossesNoFly(A, B, zones)).toBe(true);
  });

  test("зона рядом, но прямая её не задевает — обхода не было", () => {
    // центр в 300 м сбоку при радиусе 100: не касается
    const zones = [{ x: 500, y: 300, radiusM: 100 }] as never[];
    expect(directLineCrossesNoFly(A, B, zones)).toBe(false);
  });

  test("зона ПОЗАДИ площадки вылета не считается пересечённой", () => {
    // Считать расстояние до бесконечной прямой, а не до отрезка, — обычная
    // ошибка в этой геометрии: зона за спиной лежит на той же прямой и дала бы
    // ложный «обход». Центр в 400 м позади A, радиус 100 — до отрезка 400 м.
    const zones = [{ x: -400, y: 0, radiusM: 100 }] as never[];
    expect(directLineCrossesNoFly(A, B, zones)).toBe(false);
  });

  test("зона позади, но настолько большая, что накрывает площадку — считается", () => {
    // Отрицательный контроль к предыдущему: проверка обязана срабатывать, когда
    // зона действительно достаёт до отрезка, иначе прошлый тест доказывал бы
    // лишь то, что функция всегда возвращает false.
    const zones = [{ x: -50, y: 0, radiusM: 100 }] as never[];
    expect(directLineCrossesNoFly(A, B, zones)).toBe(true);
  });

  test("зон в городе нет — обходить нечего, и это НЕ повод отвечать true", () => {
    expect(directLineCrossesNoFly(A, B, [])).toBe(false);
  });

});

/**
 * «Фида нет» ≠ «правила регулятора нет».
 *
 * Замер 27.08.2026: ответ маршрута по Астане говорил «регуляторный фид не
 * подключён», и это читается как «город вне регулирования». А правило есть и
 * применяется: запретная зона UAP28 из AIP Казахстана заведена как no-fly, и
 * коридор её обходит. Сетки ПОТОЛКОВ нет — это другой вопрос.
 *
 * Расхождение было наше же: страница говорит «правило регулятора в 3 городах из
 * 3», здоровье прикладывает блок permission, а маршрут отвечал так, будто ни
 * того, ни другого нет.
 */
describe("маршрут: отсутствие потолков не выдаётся за отсутствие регулирования", () => {
  test("у города с разрешительным режимом ответ говорит о правиле, а не о его отсутствии", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { qskywayRouter } = await import("../src/routes/qskyway");
    const app = express();
    app.use(express.json());
    app.use("/api/qskyway", qskywayRouter);

    const h = await request(app).get("/api/qskyway/health");
    const airspace: Record<string, { available: boolean; permission?: { available?: boolean } }> = h.body.airspace ?? {};
    const city = Object.keys(airspace).find(
      (id) => !airspace[id]?.available && airspace[id]?.permission?.available,
    );
    expect(city, "нет города без потолков, но с разрешительным режимом — проверять нечего").toBeTruthy();

    const r = await request(app).post("/api/qskyway/route").send({ city, from: 0, to: 1 });
    expect(r.status).toBe(200);
    const note: string = r.body?.airspace?.note ?? "";
    expect(r.body?.airspace?.available).toBe(false);
    // Обе стороны: новая формулировка есть, старая — «фид не подключён» — ушла.
    expect(note, "маршрут молчит о действующем правиле регулятора").toContain("Правило регулятора при этом действует");
    expect(note, "осталась прежняя формулировка, читающаяся как «регулятора здесь нет»").not.toContain("не подключён");
  });
});
