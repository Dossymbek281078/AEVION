import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * «Задетых зданий ноль» нельзя сказать, когда задеты маршруты.
 *
 * ПОВОД (29.08.2026). У `buildingsUnderRoutes` нашлась односторонняя
 * защита: `toBeLessThanOrEqual(buildings)` — потолок без пола.
 *
 *   buildingsUnderRoutes -> 999   поймана (выше потолка)
 *   buildingsUnderRoutes -> 0     НЕ ПОЙМАНА
 *
 * Открыта опасная сторона. Этим числом мы отвечаем тому, кто оспаривает
 * высоту своего здания: «сколько ваших зданий вообще под коридорами».
 * Ноль здесь — это «ваше возражение ни на что не влияет», самый удобный
 * для нас ответ и самый дорогой, если он неверен.
 *
 * Замер на живых данных: Астана 27 задетых из 38 подставленных,
 * Нью-Йорк 1 из 1, Токио 1 из 1. То есть ноль — настоящая подмена,
 * а не «значение заменено собой».
 *
 * ЧТО ЗАКРЕПЛЯЕМ. Из устройства расчёта следует жёстко: пара площадок
 * попадает в `affectedPairs` только потому, что её маршрут проходит над
 * подставленным зданием, а это здание тем самым попадает в `touched`.
 * Значит `affectedPairs > 0` влечёт `buildingsUnderRoutes > 0`. Связь
 * выводится из ответа и не зависит от данных города.
 *
 * ГРАНИЦА, названная вслух. Пол ловит ноль, но подмену на 1 (когда
 * настоящих 27) не поймает: больше единицы ответом логически не
 * вынуждено — одно здание может лежать под всеми 23 маршрутами. Чтобы
 * закрыть и это, нужна связь, которой в ответе нет; закреплять же 27
 * значило бы краснеть при первом же уточнении данных. Записываю как
 * известную границу, а не закрываю видимостью.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("влияние подставленных высот не занижается до нуля", () => {
  test.each(["astana", "nyc", "tokyo"])(
    "[%s] задеты маршруты — значит задето хотя бы одно здание",
    async (city) => {
      const r = await request(app).get("/api/qskyway/height-substitution?city=" + city);
      expect(r.status).toBe(200);

      const b = r.body as {
        available: boolean; buildings: number;
        buildingsUnderRoutes: number; affectedPairs: number;
      };
      expect(b.available, city + ": подстановок нет, проверять нечего").toBe(true);

      // Отрицательный контроль: при нуле задетых пар пол равен нулю и
      // утверждение выполнилось бы само собой.
      expect(b.affectedPairs, city + ": задетых пар ноль — проверка была бы пустой").toBeGreaterThan(0);

      expect(
        b.buildingsUnderRoutes,
        city + ": маршрутов задето " + b.affectedPairs + ", а зданий под ними ноль — " +
          "числа спорят: пара задета именно потому, что под ней подставленное здание",
      ).toBeGreaterThan(0);

      // Прежний потолок сохраняем: задетых не может быть больше, чем всего.
      expect(b.buildingsUnderRoutes).toBeLessThanOrEqual(b.buildings);
    },
    60000,
  );
});
