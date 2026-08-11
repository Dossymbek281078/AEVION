import { describe, it, expect } from "vitest";
import { HEIGHT_REVIEWS, heightReviewFor } from "../src/data/qskywayHeightReview";
import { CITY as ASTANA } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";

// Твин помечает высоту сомнительной двумя правилами. Одно — «тег спорит с
// собственным счётом этажей»: там движок сам берёт счёт этажей, и в записи
// остаётся `was` (отвергнутый тег). Такие случаи закрыты кодом.
//
// Второе — «towers over the city»: высота в разы выше остальной застройки.
// Движок её НЕ переопределяет, потому что одиночные башни бывают настоящими.
// Значит ответ должен дать человек — иначе случай живёт в данных годами. Так и
// вышло: расхождение по Абу-Даби Плаза нашли 27.07.2026, а 11.08 оно всё ещё
// было в твине, потому что `audit-height-claims.mjs` только сообщает и его
// никто не звал.
//
// Этот тест — то самое «кто-то зовёт»: неразобранный случай красит набор.

type Suspect = { i: number; h: number; was?: number; why?: string };

const TWINS: Record<string, { dataQuality?: { suspect?: Suspect[] } }> = {
  astana: ASTANA as never,
  nyc: CITY_NYC as never,
  tokyo: CITY_TOKYO as never,
};

/** Сомнительные, которые движок НЕ переопределил — только они требуют человека. */
function unresolvedSuspects(city: string): Suspect[] {
  return (TWINS[city].dataQuality?.suspect ?? []).filter((s) => s.was === undefined);
}

describe("сомнительные высоты, которые код не закрыл, разобраны человеком", () => {
  for (const city of Object.keys(TWINS)) {
    it(`${city}: у каждого неразобранного случая есть вердикт`, () => {
      const missing = unresolvedSuspects(city).filter((s) => !heightReviewFor(city, s.i));
      expect(
        missing.map((s) => `${city}#${s.i} (${s.h} м, ${s.why})`),
        "появился сомнительный случай без разбора — запусти `npm run audit:heights <город>` "
          + "и запиши вердикт в src/data/qskywayHeightReview.ts",
      ).toEqual([]);
    });
  }

  it("разбор ссылается на источник и на элемент OSM, иначе он непроверяем", () => {
    for (const r of HEIGHT_REVIEWS) {
      expect(r.publishedSource, `${r.city}#${r.index}`).toMatch(/^https?:\/\//);
      expect(r.osm, `${r.city}#${r.index}`).toMatch(/^(way|node|relation)\/\d+$/);
      expect(r.note.length, `${r.city}#${r.index}`).toBeGreaterThan(60);
    }
  });

  it("вердикт согласован с числами, а не написан отдельно от них", () => {
    for (const r of HEIGHT_REVIEWS) {
      if (r.verdict === "overstated") expect(r.taggedM).toBeGreaterThan(r.publishedM);
      if (r.verdict === "understated") expect(r.taggedM).toBeLessThan(r.publishedM);
      if (r.verdict === "confirmed") expect(Math.abs(r.taggedM - r.publishedM)).toBeLessThan(5);
    }
  });

  it("разбор описывает случай, который в твине действительно есть", () => {
    // Иначе запись переживёт пересборку твина и станет враньём про исчезнувший
    // объект — ровно тот класс, от которого весь этот файл и лечит.
    for (const r of HEIGHT_REVIEWS) {
      const s = (TWINS[r.city]?.dataQuality?.suspect ?? []).find((x) => x.i === r.index);
      expect(s, `${r.city}#${r.index} — разбор есть, а сомнительной высоты уже нет`).toBeDefined();
      expect(s!.h).toBe(r.taggedM);
    }
  });
});
