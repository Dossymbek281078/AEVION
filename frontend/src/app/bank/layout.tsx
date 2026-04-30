import type { Metadata } from "next";
import { SentryInit } from "./_components/SentryInit";
import { TestModeBanner } from "./_components/TestModeBanner";

export const metadata: Metadata = {
  title: "AEVION Bank — wallet · royalties · trust-gated credit",
  description:
    "Unified wallet for AEC credits, automatic royalties from IP usage, savings goals, recurring payments, salary advance gated by Trust Score. Multilingual EN/RU/KZ.",
  openGraph: {
    title: "AEVION Bank — economic root of the trust ecosystem",
    description: "18 shipping features + 5 Autopilot rules. Live MVP today.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank", description: "Wallet, royalties and Trust-Score-gated credit." },
  alternates: { canonical: "/bank" },
};

// Schema.org WebApplication — surfaces /bank as a fintech web app to
// search engines so it can appear in rich app-card results with category
// and inLanguage signals. Keeps the breadcrumb chain rooted here.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AEVION Bank",
  url: "https://aevion.app/bank",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web (Chrome, Safari, Firefox, Edge); installable PWA",
  inLanguage: ["en", "ru", "kk"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Unified wallet for AEC credits, automatic royalties from IP usage, savings goals, recurring payments, salary advance gated by Trust Score. Multilingual EN/RU/KK.",
  publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
};

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      {/* Global a11y polish for every /bank/* surface. Keyboard-only focus
        ring (visible on Tab, hidden on mouse-click) + reduced-motion respect
        for any svg/path/animated element. Scoped via attribute selectors so
        it doesn't leak into other modules. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-bank-route] *,
          [data-bank-route] *::before,
          [data-bank-route] *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }

        /* Visible only when the focus came from a keyboard navigation. */
        a:focus-visible,
        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible,
        [role="tab"]:focus-visible,
        [role="button"]:focus-visible {
          outline: 2px solid #0ea5e9;
          outline-offset: 2px;
          border-radius: 6px;
        }
      `}</style>
      <div data-bank-route>
        <SentryInit />
        <TestModeBanner />
        {children}
      </div>
    </>
  );
}
