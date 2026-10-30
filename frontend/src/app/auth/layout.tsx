import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { serverLang } from "@/lib/serverLang";
import { строкиAuth } from "./authServerStrings";
import { AuthServerTextProvider } from "./authServerText";

// Кука и Accept-Language читаются на каждый запрос (serverLang) — маршрут /auth
// отрисовывается динамически (тот же приём, что у /awards с getServerT). Цена —
// один рендер на сервере на вход; выигрыш — первый кадр входа на языке посетителя
// без мигания (30.10.2026: для русского гостя первый кадр был английским).
export const dynamic = "force-dynamic";

const SITE = getSiteUrl();

export const metadata: Metadata = {
  title: "Sign in to AEVION — one identity for the whole Trust OS",
  description:
    "One AEVION account unlocks QRight authorship, QSign signatures, Bureau certificates, Planet validators, AEVION Bank, Awards, CyberChess and more. Email or social login.",
  openGraph: {
    title: "Sign in to AEVION",
    description: "One identity unlocks every module — registry, signatures, bureau, validators, bank.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign in to AEVION",
    description: "One identity for the whole Trust OS.",
  },
  alternates: { canonical: "/auth" },
  robots: { index: true, follow: true },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "Sign in", item: `${SITE}/auth` },
  ],
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Умолчание ru: вход — экран основного канала (решение Оркестратора 30.10.2026).
  const lang = await serverLang("ru");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <AuthServerTextProvider lang={lang} strings={строкиAuth(lang)}>
        {children}
      </AuthServerTextProvider>
    </>
  );
}
