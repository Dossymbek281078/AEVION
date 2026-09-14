import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QSpace — 3D-модель квартиры из плана";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Картинка предпросмотра для ссылки на модуль.
 *
 * Зачем: страница объявляла карточку `summary_large_image`, то есть обещала
 * площадкам крупное изображение, и НЕ давала его — у 60 страниц платформы
 * такая картинка есть, у QSpace не было. Ссылка, отправленная в мессенджере,
 * выглядела бы пустой карточкой рядом с чужими картинками.
 *
 * Краулеры соцсетей не исполняют скрипты, поэтому текст здесь статический и
 * русский — автоперевод страницы до них не доходит.
 *
 * Чисел на карточке намеренно нет: карточка кешируется у площадок надолго, а
 * каталоги мебели и материалов растут. Устаревшее число хуже отсутствующего.
 * По той же причине нет цены — она ещё не назначена.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0d9488 130%)",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 26, letterSpacing: 4, opacity: 0.85 }}>AEVION · QSPACE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>
            План на бумаге — квартира в 3D
          </div>
          <div style={{ fontSize: 30, opacity: 0.9, lineHeight: 1.35 }}>
            Чертёж AutoCAD, PDF или фотография плана. Три слоя: черновая отделка
            с электрикой и трубами, чистовая, мебель. Материалы, тёплый пол и
            вентиляция считаются по модели.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 25, opacity: 0.75 }}>aevion.app/qspace</div>
      </div>
    ),
    size,
  );
}
