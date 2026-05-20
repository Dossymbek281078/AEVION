import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Миграция на AEVION — гайды с DocuSign, OpenAI, Stripe, Patently",
  description:
    "Step-by-step гайды миграции на AEVION с популярных альтернатив. Time-to-migrate 5-30 дней, экономия 42-74%, zero downtime. Customer Success помогает бесплатно.",
  openGraph: {
    title: "AEVION Migration Guides",
    description: "DocuSign → QSign · OpenAI → QCoreAI · Stripe → QPayNet · Patently → IP Bureau",
    type: "website",
    url: "https://aevion.io/pricing/migrations",
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
