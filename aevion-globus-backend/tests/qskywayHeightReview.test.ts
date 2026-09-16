import { describe, it, expect } from "vitest";
import { HEIGHT_REVIEWS, heightReviewFor } from "../src/data/qskywayHeightReview";
import { CITY as ASTANA } from "../src/routes/qskyway.city";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY_TOKYO } from "../src/routes/qskyway.city.tokyo";
import { CITY_AMSTERDAM } from "../src/routes/qskyway.city.amsterdam";

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
  amsterdam: CITY_AMSTERDAM as never,
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

// Урок 11.08.2026, из-за которого этот блок появился. Аудит Токио нашёл шесть
// зданий с тегом НИЖЕ опубликованного (мэрия Токио: тег 133 м против 241.9 в
// статье). Занижение — опасная сторона: твин доверяет высоте, и занижённое
// препятствие пролетается без запаса. Но до коридоров это не дошло: в Токио
// 3504 здания из 3781 ОБМЕРЕНЫ, и самое высокое в твине — 241 м с hs=0, то есть
// обмер, а не тег.
//
// Отсюда инвариант: там, где город даёт обмер, самое высокое препятствие обязано
// быть обмеренным. Если однажды верхушку займёт заявленный тег, значит плохой тег
// перестал перекрываться — и именно с этого момента он начинает поднимать
// коридоры. Астана исключение честное: обмера там нет вовсе, тег несущий, и
// единственный сомнительный случай закрыт разбором выше.
describe("что задаёт высоту коридоров: обмер или чей-то тег", () => {
  // 16.09.2026: + Амстердам — лидар 3D BAG; верхушка (Symphony/ABN AMRO, 105–108 м) обмерена.
  const SURVEYED = ["nyc", "tokyo", "amsterdam"];

  for (const city of SURVEYED) {
    it(`${city}: самое высокое препятствие обмерено, а не заявлено`, () => {
      const bs = ((TWINS[city] as unknown as { buildings: { h?: number; hs?: number }[] }).buildings ?? [])
        .map((b) => ({ h: b.h ?? 0, hs: b.hs }))
        .sort((a, z) => z.h - a.h);
      expect(bs.length).toBeGreaterThan(100);
      // Три верхних — именно они задают потолок коридора в своих кварталах.
      for (const b of bs.slice(0, 3)) {
        expect(b.hs, `${city}: верхушка ${b.h} м пришла из тега (hs=${b.hs}), а не из обмера`).toBe(0);
      }
    });
  }

  it("Астана: обмер есть (15.09.2026), а верхушка — разобранный завышенный тег", () => {
    // Обмер пришёл из 3D-модели города (gis.esaulet.kz). Исключение из правила
    // «верхушка обмерена» остаётся, но по другой причине: самое высокое в
    // твине — тег 382 м у way/486561786 (Абу-Даби Плаза, опубликовано 310.8),
    // и центроид городской модели попал в СОСЕДНИЙ контур того же комплекса
    // (там 311 м, hs=0). Тег не перекрыт обмером, поэтому обязан оставаться
    // в списке сомнительных с разбором — это проверяет qskywayCityTwin.
    const bs = (TWINS.astana as unknown as { buildings: { h?: number; hs?: number }[] }).buildings ?? [];
    const measured = bs.filter((b) => b.hs === 0).length;
    expect(measured, "обмер Астаны пропал — источник gis.esaulet.kz отвалился?").toBeGreaterThan(200);
    const top = [...bs].sort((a, z) => (z.h ?? 0) - (a.h ?? 0))[0];
    expect(top.h).toBe(382);
    expect(top.hs, "если верхушка стала обмеренной — исключение больше не нужно").toBe(1);
  });
});

/**
 * Привязка разбора к элементу OSM, а не к номеру в массиве.
 *
 * 12.08.2026 пересборка твина Астаны сдвинула Абу-Даби Плаза со 195 на 194 —
 * в bbox добавилось пять зданий. Разбор был привязан к номеру и перестал
 * находиться; поймал тест выше, но чинить пришлось руками. Теперь твин везёт
 * `osm` в каждой спорной высоте, и поиск идёт сперва по нему.
 */
describe("разбор находится по элементу источника, а не по номеру в массиве", () => {
  it("находится по osm, даже если индекс уехал куда угодно", () => {
    const byOsm = heightReviewFor("astana", 9999, "way/486561786");
    expect(byOsm).not.toBeNull();
    expect(byOsm!.publishedM).toBe(310.8);
  });

  it("старый твин без osm по-прежнему находится по индексу", () => {
    expect(heightReviewFor("astana", 194)?.osm).toBe("way/486561786");
  });

  it("чужой osm не выдаёт чужой разбор за свой", () => {
    // индекс совпал, элемент — нет: это другое здание, и разбора у него нет
    expect(heightReviewFor("astana", 194, "way/000000000")).toBeNull();
  });

  it("твин Астаны действительно везёт osm у спорной высоты", () => {
    const sus = (ASTANA.dataQuality?.suspect ?? []) as { osm?: string | null }[];
    expect(sus.length).toBeGreaterThan(0);
    expect(sus[0].osm).toBe("way/486561786");
  });
});
