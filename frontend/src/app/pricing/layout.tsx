import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Цены AEVION — единая платформа для IP, AI и финтеха",
  description:
    "4 тарифа AEVION (Free / Pro / Business / Enterprise) и все модули под одной подпиской. Калькулятор сметы, бандлы, индустриальные кейсы, контакты с продажами.",
  openGraph: {
    title: "Цены AEVION — все модули в одной подписке",
    description:
      "Цифровая собственность, AI, подписи и платежи: всё, за что обычно платите 4 разным вендорам — теперь в AEVION с экономией до 84%.",
    type: "website",
    url: "https://aevion.io/pricing",
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
