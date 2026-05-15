import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION для образования — бесплатный Pro студентам",
  description:
    "Бесплатный AEVION Pro для студентов с .edu, sponsorship для университетов, sponsor-аккаунты для хакатонов. Без ограничений по модулям.",
  openGraph: {
    title: "AEVION для образования",
    description: "Free Pro для студентов · Sponsorship для университетов · Hackathon аккаунты.",
    type: "website",
    url: "https://aevion.io/pricing/edu",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Education",
    description: "Free Pro для .edu, sponsorship для университетов и хакатонов.",
  },
  alternates: {
    canonical: "/pricing/edu",
  },
};

export default function PricingEduLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
