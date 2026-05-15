import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Pricing AEVION — per-call билинг для разработчиков",
  description:
    "Раздельный прайс на API: QSign, QRight, IP Bureau, QCoreAI. Free quota, volume-tiers (Developer / Build / Scale / Enterprise) и SDK-quickstart.",
  openGraph: {
    title: "AEVION API Pricing",
    description:
      "Per-call билинг: $0.30/1k проверок подписи, $15/1k регистраций IP, $0.50/1k LLM-токенов. Free quota на каждом endpoint.",
    type: "website",
    url: "https://aevion.io/pricing/api-pricing",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION API Pricing",
    description: "Per-call rate card + 4 volume-tier для разработчиков.",
  },
  alternates: {
    canonical: "/pricing/api-pricing",
  },
};

export default function PricingApiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
