import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Program AEVION — Reseller / SI / Agency",
  description:
    "Channel-партнёры AEVION: 30% маржа для reseller, 20% revenue share для system integrator, white-label для agency. Sales-deck и tech-onboarding включены.",
  openGraph: {
    title: "AEVION Partner Program",
    description: "Reseller 30% · System Integrator 20% rev share · Agency white-label.",
    type: "website",
    url: "https://aevion.io/pricing/partners",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Partner Program",
    description: "3 типа партнёров: reseller, SI, agency. Sales/tech enablement.",
  },
  alternates: {
    canonical: "/pricing/partners",
  },
};

export default function PricingPartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
