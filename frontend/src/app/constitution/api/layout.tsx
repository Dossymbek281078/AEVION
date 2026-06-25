import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "Constitution API — Developer Playground · AEVION",
  description:
    "Интерактивная документация Constitution API: 19 endpoints, live curl/TypeScript/Python генерация, try-now кнопки. Public REST с 1h cache + сценарии + AI + Planet артефакты + голосование.",
  alternates: { canonical: `${SITE}/constitution/api` },
  openGraph: {
    title: "Constitution Public API — Developer Playground",
    description: "19 endpoints с live code-snippet generation. Try-now без Postman.",
    url: `${SITE}/constitution/api`,
    type: "website",
  },
};

export default function ApiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
