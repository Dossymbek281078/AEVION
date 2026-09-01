import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * У маршрута, не уложившегося в потолок, превышение НАЗВАНО.
 *
 * ПОВОД (29.08.2026, мутационный аудит). Подмена `exceedingSegments: 0`
 * проходила незамеченной, хотя меняет поведение: в потолок укладываются шесть
 * пар из сорока двух, у остальных участки с превышением есть.
 *
 * Флаг `compliant` при этом остаётся честным — и именно поэтому дыра опасна:
 * ответ говорит «не соответствует», а на вопрос «где и насколько» отвечает
 * нулём. Человек видит отказ без причины и не может ни оспорить, ни исправить.
 *
 * Сторож держит СВЯЗЬ между флагом и числами, а не проверяет их порознь.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

async function anyRoute(from: number, to: number) {
  return request(app()).post("/api/qskyway/route").send({ from, to, city: "nyc" });
}

describe("превышение потолка названо числом, а не только флагом", () => {
  test("хотя бы у одной пары есть несоответствие — иначе проверка слепа", async () => {
    // Отрицательный контроль: если все маршруты соответствуют, «всегда ноль»
    // неотличимо от правды.
    let found = false;
    for (let to = 1; to <= 6 && !found; to += 1) {
      const r = await anyRoute(0, to);
      if (r.status === 200 && r.body?.airspace?.compliant === false) found = true;
    }
    expect(found, "не нашлось ни одного несоответствующего маршрута").toBe(true);
  });

  test("не соответствует — значит участки с превышением ЕСТЬ", async () => {
    for (let to = 1; to <= 6; to += 1) {
      const r = await anyRoute(0, to);
      const a = r.body?.airspace;
      if (!a || a.compliant !== false) continue;
      expect(
        a.exceedingSegments,
        "маршрут объявлен несоответствующим, а участков с превышением ноль",
      ).toBeGreaterThan(0);
      expect(
        a.maxExceedanceM,
        "несоответствие есть, а превышение по высоте нулевое",
      ).toBeGreaterThan(0);
    }
  });

  test("🔴 участки над нулевым потолком названы, а не скрыты", async () => {
    // Восьмая дыра аудита. Подмена zeroCeilingSegments на 0 проходила
    // незамеченной, хотя настоящие значения — 39, 17, 75 участков.
    //
    // Нулевой потолок — это не «низко», а «полёт не разрешён вовсе». Скрыть
    // такие участки значит показать коридор законным там, где над ним нет
    // разрешения ни на какой высоте.
    let checked = 0;
    for (let to = 1; to <= 6; to += 1) {
      const r = await anyRoute(0, to);
      const a = r.body?.airspace;
      if (!a || a.lowestCeilingM !== 0) continue;
      checked += 1;
      expect(
        a.zeroCeilingSegments,
        "самый низкий потолок нулевой, а участков над ним ноль",
      ).toBeGreaterThan(0);
    }
    expect(checked, "не нашлось маршрута с нулевым потолком — проверка слепа").toBeGreaterThan(0);
  });

  test("нулевые участки не могут превышать общее число превышений", async () => {
    // Связь между числами: участок над нулевым потолком превышает его по
    // определению. Разойдись они — одно из двух считается не тем, чем названо.
    for (let to = 1; to <= 6; to += 1) {
      const r = await anyRoute(0, to);
      const a = r.body?.airspace;
      if (!a || a.compliant !== false) continue;
      expect(a.zeroCeilingSegments).toBeLessThanOrEqual(a.exceedingSegments);
    }
  });

  test("соответствует — значит превышений НЕТ", async () => {
    // Зеркальная половина: мало называть превышение, надо не выдумывать его
    // там, где его нет.
    for (let to = 1; to <= 6; to += 1) {
      const r = await anyRoute(0, to);
      const a = r.body?.airspace;
      if (!a || a.compliant !== true) continue;
      expect(a.exceedingSegments, "маршрут соответствует, а превышения названы").toBe(0);
    }
  });
});
