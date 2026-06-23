import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/build/ServiceWorkerRegister";
import { AutoTranslate } from "@/components/AutoTranslate";

export const metadata: Metadata = {
  title: "AEVION QBuild — Construction & Recruiting",
  description:
    "QBuild is the AEVION marketplace for construction projects, vacancies, and direct contractor messaging. Post projects, hire crews, get hired.",
  manifest: "/build-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QBuild",
  },
  openGraph: {
    type: "website",
    title: "AEVION QBuild",
    description:
      "Marketplace for construction projects, vacancies, and direct contractor messaging.",
    siteName: "AEVION QBuild",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QBuild",
    description:
      "Marketplace for construction projects, vacancies, and direct contractor messaging.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Brand-level structured data so search engines understand QBuild as a
// recognised entity. WebSite + SearchAction enables the sitelinks search
// box on Google, Organization powers knowledge-panel info.
const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AEVION QBuild",
  url: "https://aevion.com/build",
  logo: "https://aevion.com/build/icon.png",
  description:
    "AEVION QBuild — construction recruiting marketplace. Post projects, hire crews, get hired.",
  sameAs: ["https://aevion.com"],
};

const SITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AEVION QBuild",
  url: "https://aevion.com/build",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://aevion.com/build/vacancies?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }}
      />
      <ServiceWorkerRegister />
      {/* QBuild is an app-shell, so the global AutoTranslate runs with
          observe=false. Re-enable a live observer scoped to /build so every
          page (and async-loaded content) translates into all 11 AEVION
          languages when the user switches via the app-shell language pill. */}
      <AutoTranslate observe>{children}</AutoTranslate>
    </>
  );
}
