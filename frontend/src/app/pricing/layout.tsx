import type { Metadata } from "next";

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
    "Six plans (Free, Lite, Medium, Full, Universe, Enterprise) and every module "
    + "under one subscription: estimate calculator, bundles, industry cases and a "
    + "line to sales. "
    + "6 тарифов AEVION (Free / Lite / Medium / Full / Universe / Enterprise) и все модули под одной подпиской. Калькулятор сметы, бандлы, индустриальные кейсы, контакты с продажами.",
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

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
