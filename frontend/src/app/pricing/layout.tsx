import type { Metadata } from "next";
import { fromPricePerMonth } from "@/lib/termPricing";

import { разметкаТоваров } from "@/lib/shopJsonLd";
import { разметкаПриложений, оплачиваемыеПриложения } from "@/lib/appsJsonLd";

export const metadata: Metadata = {
  // Двуязычный заголовок (образец /qventure, /qright, /bureau): metadata у
  // Next статична на маршрут, языка читателя здесь нет, а доводчик <title>
  // не переводит. Страница цен — та, куда ведут западные ссылки, и в выдаче
  // она была видна только по-русски. Бренд в хвост НЕ пишем: корневой
  // шаблон добавляет "· AEVION" сам.
  // 13.09.2026: absolute, потому что имя платформы уже стоит В САМОМ
  // заголовке, а корневой шаблон добавлял второе. Замер на живом сайте:
  // «... · AEVION» у 14 страниц из 14 в выборке. Вкладка и выдача поиска
  // режут около шестидесяти знаков — второй бренд выталкивал оттуда
  // нужные слова. Страницам БЕЗ имени в заголовке шаблон по-прежнему нужен,
  // поэтому корневой файл не тронут.
  title: { absolute: "AEVION Pricing — one subscription for IP, AI and fintech · Цены и тарифы" },
  description:
    "A plan is a term of access to the whole AEVION planet: Lite, Medium, Pro, Full "
    + "and Max, paid up front — the longer the term, the cheaper the month. Free to "
    + "start, Enterprise on request, 9 apps also sold separately. "
    + "Тариф AEVION — это срок доступа ко всей планете: Lite, Medium, Pro, Full и Max с оплатой за срок вперёд — чем длиннее срок, тем дешевле месяц. Free для старта, Enterprise по запросу, отдельные приложения можно купить и по одному.",
  openGraph: {
    title: "Цены AEVION — все модули в одной подписке",
    description:
      "Цифровая собственность, AI, подписи и платежи: всё, за что обычно платите 4 разным вендорам — теперь в AEVION с экономией до 84%.",
    type: "website",
    url: "https://aevion.app/pricing",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Цены AEVION — единая GTM-платформа",
    description: "От Free до Enterprise. все модули. Калькулятор сметы.",
  },
  alternates: {
    canonical: "/pricing",
  },
};

/**
 * 🔴 Замер 23.09.2026 по проду: `/pricing` отдаёт роботу 35 547 знаков и НИ
 * ОДНОЙ цены — цены рисует браузер, а поисковик их не видит. Это главная
 * продающая страница, и в выдаче она выглядит как страница без цены.
 *
 * Сами цены НЕ переписываем числами: берём те же два помощника, что уже стоят
 * на `/shop`, `/go` и `/apps`. Разовые товары идут из каталога, приложения —
 * только те, что касса реально может продать (см. `@/lib/appsJsonLd`).
 */
export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const товары = разметкаТоваров();
  const приложения = await разметкаПриложений();
  const приложения_список = await оплачиваемыеПриложения();
  return (
    <>
      {товары ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(товары) }}
        />
      ) : null}
      {приложения ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(приложения) }}
        />
      ) : null}
      {children}
      <ЦеныДляРобота приложения={приложения_список} />
    </>
  );
}

/*
 * 🔴 ВИДИМЫЙ блок цен, отрисованный СЕРВЕРОМ (01.10.2026).
 *
 * Замер по проду в тот день: ответ /pricing — 55 733 знака, и в видимом тексте
 * НИ ОДНОЙ цены, а названий «DevHub» и «Multichat» нет вовсе (они лежат только
 * внутри скриптов). Цены рисует браузер; поисковик и превью ссылки в мессенджере
 * браузера не запускают. Это главная продающая страница, и снаружи она выглядит
 * страницей без цен и без продуктов.
 *
 * Структурированная разметка (JSON-LD выше) этого не закрывает: её читают
 * поисковые роботы, но не читает превью в чате и не видит человек с медленной
 * сетью, у которого скрипт ещё не выполнился.
 *
 * Блок НЕ скрытый и не для роботов отдельно: прятать текст от человека и
 * показывать роботу — это клоакинг, и мы так не делаем. Это обычная короткая
 * таблица внизу страницы, полезная и человеку.
 *
 * Источник ОДИН с разметкой — `оплачиваемыеПриложения()`: перечисляются ровно
 * те приложения, которые касса может продать. Цены берутся из каталога тем же
 * помощником, что и везде, и здесь НЕ переписываются числами.
 */
export function ЦеныДляРобота({ приложения }: { приложения: Awaited<ReturnType<typeof оплачиваемыеПриложения>> }) {
  if (!приложения.length) return null;
  return (
    <section
      aria-label="Цены приложений AEVION"
      style={{ padding: "24px 16px", borderTop: "1px solid rgba(15,23,42,0.08)", fontSize: 13, lineHeight: 1.6 }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Приложения и цены</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
        {приложения.map((app) => (
          <li key={app.slug}>
            <a href={`/pricing?app=${encodeURIComponent(app.slug)}#apps`} style={{ color: "#0d9488", textDecoration: "none" }}>
              {app.name}
            </a>{" "}
            — от ${fromPricePerMonth(app.baseMonthly).toFixed(2)} до ${app.baseMonthly.toFixed(2)} в месяц
          </li>
        ))}
      </ul>
    </section>
  );
}
