import type { Metadata } from "next";
import QSpaceClient from "./_client";
import { PageTracking } from "@/components/PageTracking";
import { WaitlistCapture } from "@/components/WaitlistCapture";

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
//
// 18.09.2026: до появления цены у страницы не было НИ ОДНОГО пути к деньгам —
// ни кнопки, ни формы (замер на проде: 0 «купить», 0 цен, 0 заявок). Человек,
// дочитавший до 3D-модели и списка материалов, уходил без следа. Пока цену не
// назвал основатель, путь один — заявка в общий лист ожидания с пометкой
// источника: она даёт имена покупателей для исследования воронки.
export default function Page() {
  return (
    <>
      <PageTracking page="qspace" />
      <QSpaceClient />
      <section
        aria-label="Расчёт отделки по вашему плану"
        style={{ maxWidth: 760, margin: "32px auto 48px", padding: "0 16px" }}
      >
        <WaitlistCapture
          source="qspace"
          tone="light"
          title="Хотите расчёт отделки по вашему плану?"
          // 21.09: письма QSpace не рассылает — модуль не в списке запуска, цены нет
          // (сторож everyWaitlistFormReachesTheMailing). Обещать письмо без механизма нельзя:
          // говорим ровно то, что происходит — адрес записан как спрос на платный расчёт.
          description="Оставьте почту — так мы считаем спрос на платный расчёт по чертежу и откроем его первым тем, кто спросил."
          promise="Адрес попадёт только в счёт спроса. Рассылок нет."
          buttonLabel="Заявить спрос"
          doneText="Записали. Когда платный расчёт откроется, он будет первым доступен по этому адресу."
        />
      </section>
    </>
  );
}
