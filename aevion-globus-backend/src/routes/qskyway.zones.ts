// QSkyway Phase 4 — no-fly zones + layered wind, per city.
//
// ⚠️ No-fly зоны здесь — иллюстративные данные, НЕ авторитетный источник
// ограничений. Реальные запретные зоны берутся из официальных публикаций
// регулятора (FAA UAS / NOTAM, EASA U-space, CAAC) — ещё не подключено.
//
// WindConfig ниже — fallback-модель, используется только когда живой METAR
// (qskyway.metar.ts, aviationweather.gov) недоступен для города. При
// доступном METAR наземный ветер (fromDeg/baseMs) реальный; perBandMs
// (рост с высотой) остаётся иллюстративным всегда — METAR не сообщает ветер
// на высоте.

export interface NoFlyZone {
  id: string;
  name: string;
  kind: "permanent" | "temporary";
  center: [number, number]; // [lon, lat]
  radiusM: number;
  until?: string; // ISO-8601 для temporary
  /**
   * What the regulator actually publishes for this spot, where we know it.
   *
   * A demo circle named after a real restriction is worse than an unnamed one:
   * the name makes it look sourced. Astana's "government quarter" placeholder
   * understated the published prohibition fourteenfold in radius and nothing on
   * screen said so. Where a real rule is known, it is named here.
   */
  realityNote?: string;
  realityNoteEn?: string;
}

export interface WindConfig {
  // Метеорологическое направление — ОТКУДА дует ветер, градусы (0=N,90=E).
  fromDeg: number;
  baseMs: number; // у земли
  perBandMs: number; // прирост на каждую высотную полосу
}

export const NOFLY: Record<string, NoFlyZone[]> = {
  astana: [
    {
      id: "nfz-gov", name: "Правительственный квартал (демо-геометрия)", kind: "permanent",
      center: [71.4418, 51.1268], radiusM: 320,
      realityNote:
        "Это НАША демо-окружность, а не опубликованная зона. Реально действует запретная зона UAP28 " +
        "(AIP KZ ENR 5.1): круг радиусом 4.5 км, от земли до 4800 ft, круглосуточно — он накрывает 100% " +
        "твина, то есть в 14 раз шире по радиусу, чем эта фигура. Демо-круг оставлен, чтобы показать " +
        "механику обхода; за реальным ограничением см. блок airspace.permission.",
      realityNoteEn:
        "This is OUR demo circle, not a published zone. The real restriction is prohibited "
        + "area UAP28 (AIP KZ ENR 5.1): a circle of 4.5 km radius, ground to 4800 ft, H24 - it "
        + "covers 100% of the twin, i.e. 14 times wider in radius than this figure. The demo "
        + "circle is kept to show the avoidance mechanics; for the real restriction see the "
        + "airspace.permission block.",
    },
    { id: "nfz-event", name: "Массовое мероприятие", kind: "temporary", center: [71.4270, 51.1240], radiusM: 240, until: "2026-07-13T20:00:00Z" },
  ],
  nyc: [
    { id: "nfz-crowd", name: "Плотная толпа — Таймс-сквер", kind: "temporary", center: [-73.9839, 40.7591], radiusM: 210, until: "2026-07-13T06:00:00Z" },
    { id: "nfz-sensitive", name: "Чувствительный объект", kind: "permanent", center: [-73.9800, 40.7520], radiusM: 200 },
  ],
  tokyo: [
    { id: "nfz-cluster", name: "Кластер небоскрёбов Ниси-Синдзюку — ограничение", kind: "permanent", center: [139.69569, 35.69335], radiusM: 220 },
    { id: "nfz-crowd", name: "Плотная толпа — станция Синдзюку", kind: "temporary", center: [139.70000, 35.68883], radiusM: 200, until: "2026-07-20T12:00:00Z" },
  ],
};

export const WIND: Record<string, WindConfig> = {
  // Астана — открытая степь, преобладающий юго-западный/южный ветер, сильный.
  astana: { fromDeg: 210, baseMs: 4, perBandMs: 1.6 },
  // Нью-Йорк — преобладающий западный/северо-западный.
  nyc: { fromDeg: 290, baseMs: 3, perBandMs: 1.3 },
  // Токио — летний тихоокеанский муссон, преобладающий южный ветер, умеренный.
  tokyo: { fromDeg: 180, baseMs: 3, perBandMs: 1.2 },
};
