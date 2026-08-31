import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * `coveragePct` согласован с остальными числами того же ответа.
 *
 * ПОВОД (29.08.2026). Мутация показала, что это поле не проверяет никто:
 *
 *   coveragePct -> 7     не поймана
 *   coveragePct -> 100   не поймана
 *
 * ⚠️ ЧЕСТНОЕ ЧТЕНИЕ ЗАМЕРА. Вторая строка НЕ доказывает дыру: сетка
 * потолков сейчас есть только у Нью-Йорка, и покрытие у него РОВНО 100 %.
 * Значит подмена на 100 не меняет поведения, и её выживание — ловушка
 * «значение заменено собой», а не находка. Настоящая дыра одна: занижение.
 *
 * Замер по всем городам: astana available=false, tokyo available=false,
 * nyc cov=100 exc=75 zero=75 из 86 участков.
 *
 * ЧТО ЗАКРЕПЛЯЕМ. Из кода `assessCeiling` следует жёстко: участок
 * попадает в `exceedingSegments` только после `covered++`, то есть
 * превышающие — ПОДМНОЖЕСТВО покрытых. Отсюда нижняя граница, выводимая
 * из самого ответа, без знания данных:
 *
 *     coveragePct >= 100 * exceedingSegments / alts.length
 *
 * Она не устареет при улучшении данных и не зависит от города.
 *
 * ГРАНИЦА СТОРОЖА, названная вслух. Он ловит ЗАНИЖЕНИЕ. Завышение
 * («покрыто всё») сегодня не отличить от правды, потому что
 * единственный город с сеткой покрыт полностью. Появится город с
 * частичным покрытием — здесь же добавить отношение между городами,
 * как в `qskywayConfidenceIsNotConstant`. Оставляю это записанным, а не
 * сделанным: проверка, притворяющаяся полной, хуже отсутствующей.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("покрытие потолками согласовано с превышениями", () => {
  test("покрытых участков не меньше, чем превышающих", async () => {
    const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city: "nyc" });
    expect(r.status).toBe(200);

    const a = r.body.airspace as {
      available: boolean; coveragePct: number; exceedingSegments: number;
    };
    const segments = (r.body.alts as number[]).length;

    // Отрицательный контроль: без сетки и без превышений граница равна
    // нулю, и утверждение выполнится само собой.
    expect(a.available, "у Нью-Йорка пропала сетка потолков — мерить нечего").toBe(true);
    expect(a.exceedingSegments, "превышений ноль — нижняя граница пуста").toBeGreaterThan(0);
    expect(segments, "маршрут без участков").toBeGreaterThan(0);

    const floorPct = Math.floor((100 * a.exceedingSegments) / segments);
    expect(
      a.coveragePct,
      "покрытие (" + a.coveragePct + " %) меньше доли превышающих участков (" + floorPct +
        " %), а превышающие считаются только среди покрытых — числа спорят друг с другом",
    ).toBeGreaterThanOrEqual(floorPct);
  }, 60000);
});
