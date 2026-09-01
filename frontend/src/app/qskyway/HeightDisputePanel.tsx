"use client";

import { useI18n } from "@/lib/i18n";

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
  /** элемент OSM; null — твин не знает, по чему проверять */
  osm: string | null;
  /** null, если тега OSM нет: ноль означал бы «здание нулевой высоты». */
  taggedM: number | null;
  /**
   * Что публикует статья объекта. `null` — разбора человеком ещё нет, и это
   * НЕ ноль: «против 0 м в статье» — правдоподобная цифра вместо «не знаем»,
   * ровно та подмена, которую модуль ищет в чужих данных.
   */
  publishedM: number | null;
  publishedSource: string | null;
  segments: number;
  cruiseAltM: number;
  cruiseAltMIfPublished: number | null;
  cruiseDeltaM: number | null;
  distanceKm: number;
  distanceKmIfPublished: number | null;
  note: string;
}

export function HeightDisputePanel({ dispute }: { dispute: HeightDispute | null }) {
  // Хук зовём ДО раннего возврата: правила хуков не разрешают условный вызов,
  // а панель пуста ровно тогда, когда спора нет.
  const { t } = useI18n();
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
      {t("qskyway.disp.raised")}
      {cruiseDeltaM != null && cruiseDeltaM > 0 && <>{t("qskyway.disp.higherThan", { d: cruiseDeltaM })}</>}
      <span style={{ color: "#5f7086" }}>{t("qskyway.disp.segments", { n: segments })}</span>
      <div style={{ color: "#9fb0c4", fontSize: 10.5, marginTop: 3, whiteSpace: "normal" }}>
        {/*
          Три случая, а не два. Третий добавлен 29.08: у высоты по тегу
          теперь бывает `null` — тега нет. Печатать в этом месте ноль
          значило бы утверждать, что здание нулевой высоты, а спор идёт
          как раз о высоте.
        */}
        {taggedM == null
          ? t("qskyway.disp.noTag")
          : publishedM != null
            ? t("qskyway.disp.taggedVsPublished", { tagged: taggedM, published: publishedM })
            : t("qskyway.disp.taggedNoReview", { tagged: taggedM })}
        {cruiseAltMIfPublished != null && (
          <>{t("qskyway.disp.cruiseWouldBe", { alt: cruiseAltMIfPublished, was: cruiseAltM })}</>
        )}
        {/* Крюк вокруг завышенного препятствия — вторая половина цены: спорная
            высота меняет не только эшелон, но и сам путь. */}
        {distanceKmIfPublished != null && distanceKmIfPublished !== distanceKm && (
          <>{t("qskyway.disp.routeLength", { km: distanceKm, wasKm: distanceKmIfPublished })}</>
        )}
        {t("qskyway.disp.fixBelongsToSource")}
        {/* `"—"` — форма прежнего бэкенда: на проде может стоять сборка до
            перехода на null, и прочерк ссылкой быть не должен. */}
        {osm != null && osm !== "—" && (
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
