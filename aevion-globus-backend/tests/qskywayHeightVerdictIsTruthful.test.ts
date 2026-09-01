import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { HEIGHT_REVIEWS } from "../src/data/qskywayHeightReview";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Спорная высота не объявляется подтверждённой.
 *
 * ПОВОД (29.08.2026, мутационный аудит). Подмена вердикта на "confirmed"
 * проходила незамеченной, хотя меняет поведение: в разборе есть высоты с
 * вердиктом "overstated"/"understated", и на `/height-dispute` они стали бы
 * подтверждёнными.
 *
 * Модуль тем и отличается, что честен про неуверенность в высотах. Спрятать
 * собственный разбор — значит отменить эту черту, не тронув ни строчки в
 * маркетинге.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const disputed = HEIGHT_REVIEWS.filter((r) => r.verdict !== "confirmed");

describe("вердикт по высоте доезжает таким, каков он в разборе", () => {
  test("неподтверждённые высоты в разборе ЕСТЬ — иначе проверка пуста", () => {
    // Отрицательный контроль: исчезнут спорные — и «всегда confirmed» станет
    // неотличимо от правды, а набор останется зелёным.
    expect(disputed.length, "в разборе нет ни одной спорной высоты").toBeGreaterThan(0);
  });

  test("ответ не объявляет спорную высоту подтверждённой", async () => {
    const city = disputed[0].city;
    const res = await request(app()).get("/api/qskyway/height-dispute?city=" + city);
    expect(res.status).toBe(200);
    const rows: Array<{ osm?: string | null; verdict?: string }> = res.body?.disputed ?? [];
    // ⚠️ Массив называется `disputed`. Первая версия угадывала `rows`/`items`,
    // получала пустоту и проходила ВХОЛОСТУЮ — мутация «всегда confirmed» её
    // пережила. Форму ответа надо спрашивать, а не угадывать.
    expect(Array.isArray(rows), "форма ответа изменилась — проверку надо переписать").toBe(true);
    expect(rows.length, "спорных высот в ответе нет — проверять нечего").toBeGreaterThan(0);
    const confirmedOnly = rows.every((r) => r.verdict === "confirmed");
    expect(
      confirmedOnly,
      "все вердикты «подтверждено», хотя в разборе есть спорные — разбор скрыт",
    ).toBe(false);
  });

  test("каждый вердикт в ответе совпадает с разбором по тому же зданию", async () => {
    const city = disputed[0].city;
    const res = await request(app()).get("/api/qskyway/height-dispute?city=" + city);
    const rows: Array<{ osm?: string | null; verdict?: string }> = res.body?.disputed ?? [];
    for (const r of rows) {
      if (!r.osm) continue;
      const src = HEIGHT_REVIEWS.find((x) => x.osm === r.osm);
      if (!src) continue;
      expect(r.verdict, "вердикт по " + r.osm + " разошёлся с разбором").toBe(src.verdict);
    }
  });
});
