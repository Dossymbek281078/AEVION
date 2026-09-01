import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * `/health.slotsBooked` считает настоящее хранилище, а не константу.
 *
 * ПОВОД (29.08.2026, последние минуты окна). Применил правило «начинать
 * аудит с самых длинных литералов ответа» к `/health` — и первая же
 * проверка дала дыру: поле `slotsBooked` не проверял НИКТО.
 *
 * Замер, две мутации, обе выжили:
 *   slotsBooked -> 0     не поймана
 *   slotsBooked -> 777   НЕ ПОЙМАНА
 *
 * Вторая здесь обязательна. Без неё находку не отличить от ловушки
 * «ноль заменён нулём»: в тестовой базе броней может не быть вовсе, и
 * подстановка нуля тогда НЕ МЕНЯЕТ ПОВЕДЕНИЯ — мутация выживает у
 * исправного кода. Заметное 777 эту двусмысленность снимает.
 *
 * Почему именно это поле. Ровно оно 27.08 публиковало `slotsBooked: 39`
 * как спрос, когда настоящих броней было НОЛЬ: считались брони нашего
 * же смоука. Тогда рядом появилось честное `slotsBookedLive`, а само
 * исходное поле так и осталось без сторожа — то есть починили витрину,
 * не закрыв источник.
 *
 * Проверяем ПРИРОСТ, а не абсолютное число: хранилище общее на прогон,
 * соседний тест мог оставить в нём записи, и `toBe(2)` от полного счёта
 * краснел бы от чужой работы. Прирост же зависит только от нас.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

async function bookedNow(): Promise<number> {
  const res = await request(app()).get("/api/qskyway/health");
  expect(res.status).toBe(200);
  expect(
    typeof res.body.slotsBooked,
    "поля slotsBooked нет в ответе — сторож проверял бы undefined",
  ).toBe("number");
  return res.body.slotsBooked as number;
}

describe("/health: число броней приходит из хранилища", () => {
  test("забронировали две — счётчик вырос ровно на две", async () => {
    const before = await bookedNow();

    await request(app()).post("/api/qskyway/slots").send({
      routeId: "health-count-probe-1", t0: "2032-05-05T00:00:00.000Z",
      t1: "2032-05-05T00:10:00.000Z", holder: "Aero Taxi KZ",
    });
    // Вторая — с демо-держателем НАМЕРЕННО. `slotsBooked` обещает ВСЕ
    // записи, а не только живые; если кто-то однажды подменит его на
    // `slotsBookedLive`, прирост станет 1 вместо 2, и подмена всплывёт.
    await request(app()).post("/api/qskyway/slots").send({
      routeId: "health-count-probe-2", t0: "2032-05-06T00:00:00.000Z",
      t1: "2032-05-06T00:10:00.000Z", holder: "AEVION demo",
    });

    const after = await bookedNow();

    expect(
      after - before,
      "число броней в /health не следует за хранилищем: завели две записи, счётчик так не считает",
    ).toBe(2);

    // Отрицательный контроль. Прирост «2» получился бы и у пары
    // счётчиков, которые обнуляются на каждом запросе; требуем, чтобы
    // итог был не меньше заведённого нами — иначе проверка пуста.
    expect(after, "хранилище пусто после двух броней — измеряли не то").toBeGreaterThanOrEqual(2);
  });
});
