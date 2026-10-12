import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Миграция на AEVION — гайды с DocuSign, OpenAI, Stripe, Patently",
  description:
    // 🔴 12.10.2026: «экономия 42-74%» убрана — расчёта под числом нет, а
    // сравнение идёт с ценами чужих продуктов. Остальное — проверяемое.
    "Пошаговые гайды перехода на AEVION с DocuSign, OpenAI, Stripe и Patently: что переносится, в каком порядке и без простоя. Сколько сэкономите — посчитаем по вашим объёмам.",
  openGraph: {
    title: "AEVION Migration Guides",
    description: "DocuSign → QSign · OpenAI → QCoreAI · Stripe → QPayNet · Patently → IP Bureau",
    type: "website",
    url: "https://aevion.app/pricing/migrations",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Migration Guides",
    description: "Гайды миграции с DocuSign / OpenAI / Stripe / Patently на AEVION.",
  },
  alternates: {
    canonical: "/pricing/migrations",
  },
};

export default function PricingMigrationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
