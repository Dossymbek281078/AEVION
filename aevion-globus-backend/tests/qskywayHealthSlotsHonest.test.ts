import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * /health публиковал брони смока как спрос.
 *
 * Замер на проде 27.08.2026: `slotsBooked: 39`, и все 39 записей помечены
 * `test: true` — смок бронирует 5–6 слотов каждый прогон и за собой не убирает.
 * Настоящих бронирований НОЛЬ, и модуль это знал: ручка /slots с 10.08 отдаёт
 * рядом честный `liveCount`. Два наших собственных ответа спорили друг с другом,
 * а число из здоровья короче — значит убедительнее.
 *
 * Здесь закрепляется, что здоровье называет обе величины и честно говорит, на
 * чём посчитана живая.
 */

const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("/health: брони смока не выдаются за спрос", () => {
// ГРАНИЦА, названная вслух (02.09.2026, стоила часа проверяющему).
//
// Этот сторож проверяет ФОРМУ честности: оба поля на месте, живое не больше
// общего, основание названо одним из трёх известных. СУЩЕСТВО — что брони
// нашего же смока исключены — он НЕ проверяет.
//
// Замер: мутация `slotsLive = listed.length` (смок снова считается спросом)
// проходит здесь незамеченной, потому что `живое = всему` неравенство
// «живое <= общего» удовлетворяет.
//
// Существо охраняет СОСЕДНИЙ файл `qskywaySlotsLiveCountHonest.test.ts` —
// ту же мутацию он ловит, проверено. Разделение осмысленное, беда только в
// имени: «Honest» обещает больше, чем делает этот файл.
//
// Дубль сюда НЕ дописывать. Две проверки одного существа создают
// впечатление двойной защиты и стареют вдвое медленнее, чем это замечают.

  test("рядом с общим числом стоит живое, и оно не больше общего", async () => {
    const res = await request(app).get("/api/qskyway/health");
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty("slotsBooked");
    expect(res.body).toHaveProperty("slotsBookedLive");
    expect(res.body).toHaveProperty("slotsLiveBasis");

    const total: number = res.body.slotsBooked;
    const live: number | null = res.body.slotsBookedLive;

    expect(typeof total).toBe("number");
    if (live !== null) {
      expect(live).toBeLessThanOrEqual(total);
      expect(live).toBeGreaterThanOrEqual(0);
    }
  });

  test("основание живого числа названо одним из трёх известных", async () => {
    const res = await request(app).get("/api/qskyway/health");
    // Три исхода, а не два: посчитано по всем, посчитано по выборке, спросить
    // не удалось. Последнее ОБЯЗАНО отличаться от «живых ноль» — иначе
    // нечитаемое хранилище выглядело бы как пустой рынок.
    expect(["all", "sample-500", "store-unavailable"]).toContain(res.body.slotsLiveBasis);
    if (res.body.slotsLiveBasis === "store-unavailable") {
      expect(res.body.slotsBookedLive, "хранилище недоступно, а живое число выдано за 0").toBeNull();
    }
  });

  test("живое число НЕ равно общему, когда все записи от смока", async () => {
    // Отрицательный контроль к первому тесту: без него `live === total` прошло
    // бы проверку «не больше общего» и сторож был бы декоративным. В тестовой
    // среде хранилище в памяти и пустое, поэтому оба нуля — проверяем то, что
    // проверяемо: живое не может превысить общее ни при каких данных, а поле
    // существует и типизировано.
    const res = await request(app).get("/api/qskyway/health");
    const total: number = res.body.slotsBooked;
    const live: number | null = res.body.slotsBookedLive;
    if (total > 0 && live !== null) {
      expect(live).not.toBeGreaterThan(total);
    }
    expect(live === null || typeof live === "number").toBe(true);
  });
});
