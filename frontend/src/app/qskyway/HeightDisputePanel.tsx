"use client";

/**
 * Цена спорной высоты для КОНКРЕТНОГО рейса.
 *
 * Чип «⚠ высота под вопросом» в шапке говорит про город, а коридор до 12.08.2026
 * молчал о том, что поднят тем же самым числом. Это расхождение двух наших же
 * ответов: одна часть продукта отменяет предупреждение другой.
 *
 * Отдельным файлом, а не куском разметки в _client.tsx, по практической причине:
 * на живых городах блок не появляется (движок платит за высоту и обходит башню —
 * 0 из 42 пар Астаны), поэтому увидеть его глазами негде. Здесь он рендерится в
 * тесте с настоящими числами разбора, и «ничего не показал» перестаёт быть
 * неотличимым от «нечего показывать».
 */
export interface HeightDispute {
  building: number;
  osm: string;
  taggedM: number;
  publishedM: number;
  publishedSource: string;
  segments: number;
  cruiseAltM: number;
  cruiseAltMIfPublished: number | null;
  cruiseDeltaM: number | null;
  distanceKm: number;
  distanceKmIfPublished: number | null;
  note: string;
}

export function HeightDisputePanel({ dispute }: { dispute: HeightDispute | null }) {
  if (!dispute) return null;
  const {
    osm, taggedM, publishedM, segments, cruiseAltM,
    cruiseAltMIfPublished, cruiseDeltaM, distanceKm, distanceKmIfPublished,
  } = dispute;
  return (
    <div
      data-testid="height-dispute"
      style={{ padding: "10px 14px", borderTop: "1px solid #1e2836", fontFamily: "monospace", fontSize: 11, color: "#fbbf24" }}
    >
      ⚠ коридор поднят спорной высотой
      {cruiseDeltaM != null && cruiseDeltaM > 0 && <> · на {cruiseDeltaM} м выше, чем по опубликованной</>}
      <span style={{ color: "#5f7086" }}> · участков {segments}</span>
      <div style={{ color: "#9fb0c4", fontSize: 10.5, marginTop: 3, whiteSpace: "normal" }}>
        {taggedM} м в теге OSM против {publishedM} м в статье объекта.
        {cruiseAltMIfPublished != null && (
          <> Крейсерская была бы {cruiseAltMIfPublished} м вместо {cruiseAltM} м.</>
        )}
        {/* Крюк вокруг завышенного препятствия — вторая половина цены: спорная
            высота меняет не только эшелон, но и сам путь. */}
        {distanceKmIfPublished != null && distanceKmIfPublished !== distanceKm && (
          <> Длина маршрута — {distanceKm} км вместо {distanceKmIfPublished} км.</>
        )}{" "}
        Высоту не переписываем: починка принадлежит источнику
        {osm !== "—" && (
          <>
            {" "}(
            <a href={`https://www.openstreetmap.org/${osm}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2dd4bf" }}>
              {osm}
            </a>
            )
          </>
        )}.
      </div>
    </div>
  );
}
