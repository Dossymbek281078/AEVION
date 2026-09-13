import type { Metadata } from "next";
import QSpaceClient from "./_client";
import { PageTracking } from "@/components/PageTracking";

const TITLE = "QSpace — 3D-модельер помещений из 2D-плана";
// Описание перечисляет ВСЕ три формата входа. Прежде здесь стоял только DXF —
// занижение в безопасную сторону, но человек с планом в PDF или фотографией
// чертежа нас по такому описанию не найдёт.
const DESCRIPTION =
  "Загрузите план — чертёж AutoCAD (DXF), векторный PDF или фотографию плана. "
  + "QSpace построит 3D-модель квартиры с тремя слоями: черновая отделка с разводкой "
  + "электрики и труб, чистовая (краска, пол, свет), декор и мебель. Посчитает "
  + "материалы, тёплый пол, вентиляцию и мощность сплит-системы, выдаст чертёж "
  + "сверху для печати. Всё в браузере, без установки программ.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "3D модель квартиры", "планировка", "дизайн интерьера", "DXF", "AutoCAD",
    "ремонт", "разводка электрики", "расстановка мебели", "AEVION", "QSpace",
  ],
  alternates: { canonical: "/qspace" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/qspace",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// MVP открыт без платной стены: смотреть и примерять можно всем.
// Монетизация (экспорт слоёв, смета, GLB) — этап 2, там и появится paywall.
export default function Page() {
  return (
    <>
      <PageTracking page="qspace" />
      <QSpaceClient />
    </>
  );
}
