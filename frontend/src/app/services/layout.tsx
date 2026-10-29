import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Услуги AEVION — ИИ-ролики, фото товаров, перевод и озвучка" },
  description:
    "Три услуги с образцами и ценами: ИИ-ролики для бизнеса от $49 за 3 ролика, ИИ-фото товаров для маркетплейсов от $15, перевод и озвучка роликов с подгонкой губ — проба 60 секунд за $19.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Услуги AEVION — ИИ-ролики, фото товаров, перевод и озвучка",
    description: "Образцы и цены. Готово до 3 рабочих дней.",
    url: "https://aevion.app/services",
    siteName: "AEVION",
    type: "website",
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
