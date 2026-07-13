// QSkyway Phase 4 — no-fly zones + layered wind, per city.
//
// ⚠️ Иллюстративные данные, НЕ авторитетный источник ограничений. Реальные
// запретные зоны берутся из официальных публикаций регулятора (FAA UAS / NOTAM,
// EASA U-space, CAAC). Ветер здесь — детерминированная демо-модель; в проде
// подключается фид METAR/прогноза.

export interface NoFlyZone {
  id: string;
  name: string;
  kind: "permanent" | "temporary";
  center: [number, number]; // [lon, lat]
  radiusM: number;
  until?: string; // ISO-8601 для temporary
}

export interface WindConfig {
  // Метеорологическое направление — ОТКУДА дует ветер, градусы (0=N,90=E).
  fromDeg: number;
  baseMs: number; // у земли
  perBandMs: number; // прирост на каждую высотную полосу
}

export const NOFLY: Record<string, NoFlyZone[]> = {
  astana: [
    { id: "nfz-gov", name: "Правительственный квартал", kind: "permanent", center: [71.4418, 51.1268], radiusM: 320 },
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
