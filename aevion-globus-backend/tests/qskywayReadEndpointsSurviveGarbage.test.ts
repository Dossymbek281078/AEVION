import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ни одна читающая ручка не отвечает 5xx на мусор во входе.
 *
 * ЗАЧЕМ. 28.08.2026 проба граничными числами нашла настоящий дефект: дробный
 * индекс площадки давал 500 с ПУСТЫМ телом, тогда как -1, 9999 и 1e9 отвечали
 * честным 422. По правилам платформы неверные данные — это 4xx; 500 значит
 * «сломались мы», поднимает людей и топит Sentry шумом.
 *
 * Текстовым свипом этот класс НЕ находится: детектор «проверяют typeof number,
 * потом индексируют» дал ноль и на СЛОМАННОЙ версии — значение уходит
 * параметром в другую функцию, и анализ теряет след на границе. Нашла проба.
 * Поэтому она здесь постоянно, а не разово.
 *
 * ⚠️ Первый тест — КОНТРОЛЬ ПРИБОРА. Без него «пятисоток нет» неотличимо от
 * «проба не умеет их видеть», и зелёный цвет ничего не значит.
 */

const a = express();
a.use(express.json());
a.use("/api/qskyway", qskywayRouter);

const GETS = ["/health", "/cities", "/city", "/airspace/impact", "/height-substitution",
  "/height-dispute", "/vertiports", "/verify", "/airspace/proof", "/slots"];
const МУСОР: Array<[string, unknown]> = [
  ["city", "zzz"], ["city", ""], ["city", "constructor"], ["city", "__proto__"],
  ["city", "1.5"], ["city", "-1"], ["id", "1.5"], ["id", ""], ["limit", "zzz"],
  ["before", "zzz"], ["from", "1.5"], ["to", "1e999"],
];

describe("проба граничными входами по всем читающим ручкам", () => {
  test("охват пробы не сократился молча", () => {
    // Перебор идёт ПО СПИСКАМ: убрал ручку или мусорное значение — проба
    // молча перестала их спрашивать и осталась зелёной. Это зеркальная
    // сторона храповика: там опасен рост списка долга, здесь — сокращение
    // положительного. Пороги поднимать можно и нужно, опускать — только
    // вместе с настоящим удалением ручки.
    expect(GETS.length, "список читающих ручек сократился").toBeGreaterThanOrEqual(10);
    expect(МУСОР.length, "набор мусорных значений сократился").toBeGreaterThanOrEqual(12);
  });

  test("КОНТРОЛЬ ПРИБОРА: заведомо падающая ручка обязана попасть в находки", async () => {
    const b = express();
    b.get("/api/qskyway/__boom", () => { throw new Error("нарочно"); });
    b.use("/api/qskyway", qskywayRouter);
    const r = await request(b).get("/api/qskyway/__boom").query({ city: "zzz" });
    expect(r.status, "проба не увидела бы 5xx — значит ноль ничего не значит").toBeGreaterThanOrEqual(500);
  });

  test("ни одна не отвечает 5xx", async () => {
    const плохие: string[] = [];
    for (const p of GETS) {
      for (const [k, v] of МУСОР) {
        const r = await request(a).get("/api/qskyway" + p).query({ [k]: v as string });
        if (r.status >= 500) плохие.push(p + "?" + k + "=" + JSON.stringify(v) + " -> " + r.status);
      }
    }
    expect(плохие.join(" | ")).toBe("");
  });
});
