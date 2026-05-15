import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners Portal — AEVION",
  description:
    "Кабинет партнёра AEVION: deal registration, pipeline, статус сделок. Reseller / System Integrator / Agency программа. Margin 30%.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "AEVION Partners Portal",
    description: "Deal registration, pipeline и статус сделок.",
    type: "website",
    url: "https://aevion.io/pricing/partners-portal",
    siteName: "AEVION",
  },
  alternates: {
    canonical: "/pricing/partners-portal",
  },
};

export default function PartnersPortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
