import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Интеграции AEVION — Slack, Google, Salesforce, Zapier и 16+ других",
  description:
    "Каталог интеграций AEVION со сторонними SaaS: Slack, Google Workspace, Salesforce, HubSpot, Zapier, GitHub, Stripe, Telegram. Live / beta / coming soon.",
  openGraph: {
    title: "AEVION Integrations",
    description: "20+ интеграций: коммуникации, CRM, автоматизация, платежи, разработчикам.",
    type: "website",
    url: "https://aevion.io/pricing/integrations",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Integrations",
    description: "Slack · Google · Salesforce · Zapier · GitHub · Stripe · Telegram + ещё 13.",
  },
  alternates: {
    canonical: "/pricing/integrations",
  },
};

export default function PricingIntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
