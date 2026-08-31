import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "AEVION Bank — Trust Badge embed",
  description: "Generate an embeddable Trust Badge SVG for your portfolio, profile, or website.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/badge" },
  // Своя карточка предпросмотра. Страницу шлют, чтобы показать свой значок —
  // то есть ссылку на неё пересылают чаще, чем открывают из меню. Без блока
  // openGraph она приходила в мессенджер общим заголовком сайта.
  openGraph: {
    title: "AEVION Bank — Trust Badge embed",
    description: "Generate an embeddable Trust Badge SVG for your portfolio, profile or website.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank — Trust Badge embed",
    description: "Generate an embeddable Trust Badge SVG for your portfolio, profile or website.",
  },
};

export default function BadgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/badge" name="Trust Badge Embed" />
      {children}
    </>
  );
}
