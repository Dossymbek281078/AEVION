import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution — World-System Design Lab · AEVION",
  description:
    "8 ползунков → 10 исторических режимов. Лаборатория устройства мира: настрой пол снизу, верховенство закона, ротацию, прозрачность и увидь, в какой регим скатывается общество. Open-source + QSign-подписанные сценарии.",
  alternates: {
    canonical: `${SITE}/constitution`,
    languages: {
      ru: `${SITE}/constitution`,
      en: `${SITE}/constitution`,
      kk: `${SITE}/constitution`,
    },
  },
  openGraph: {
    title: "Constitution — World-System Design Lab",
    description:
      "8 параметров — 10 режимов. От феодализма до Open Access за 8 веков. Сохраняй сценарии, сравнивай, делись.",
    url: `${SITE}/constitution`,
    siteName: "AEVION",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Constitution — Лаборатория устройства мира",
    description: "8 ползунков → 10 режимов. Симулятор политэкономии от AEVION.",
  },
  robots: { index: true, follow: true },
};

const JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/constitution`,
      name: "Constitution — World-System Design Lab",
      url: `${SITE}/constitution`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
        {
          "@type": "Offer",
          price: "9",
          priceCurrency: "USD",
          name: "Constitution Pro",
        },
      ],
      featureList: [
        "8 governance sliders",
        "10 regime classifications",
        "QSign cryptographic signatures",
        "AI advisor via QCoreAI",
        "PDF export with QR verification",
        "Real-time multi-user collaboration",
        "8-lesson Academy course",
        "Public REST API",
      ],
      author: { "@type": "Organization", name: "AEVION", url: SITE },
    },
    {
      "@type": "Course",
      "@id": `${SITE}/constitution/learn`,
      name: "AEVION Constitution Academy",
      description:
        "8-lesson interactive course on the four pillars of political economy: floor below, rule of law, rotation & multiple statuses, growing pie. Each lesson: theory, historical example, hands-on task, and certificate on completion.",
      url: `${SITE}/constitution/learn`,
      provider: { "@type": "Organization", name: "AEVION", url: SITE },
      inLanguage: ["ru", "en"],
      educationalLevel: "intermediate",
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: "PT2H",
      },
    },
  ],
};

export default function ConstitutionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />
      {children}
    </>
  );
}
