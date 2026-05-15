import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "QPersona — AI Personality Twin · AEVION",
  description:
    "Создайте AI-двойника по вашим текстам/голосу/решениям. Делегируйте рутинные коммуникации, сохраняя свой стиль.",
  alternates: { canonical: `${SITE}/qpersona` },
  openGraph: {
    type: "website",
    url: `${SITE}/qpersona`,
    title: "QPersona — AI Personality Twin",
    description: "AI-twin trained on your texts/voice. Delegate routine comms in your style.",
    siteName: "AEVION",
    images: [{ url: `${SITE}/qpersona/opengraph-image`, width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export default function QPersonaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
