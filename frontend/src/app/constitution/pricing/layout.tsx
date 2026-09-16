import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  // 15.09.2026: Pro и Team отдельными подписками сняты — Pro входит в подписку
  // AEVION (срок 1–12 месяцев, оплата вперёд). Цену в метаданных не называем:
  // заголовок живёт в выдаче и превью месяцами и расходится с кассой молча.
  title: "Pricing — Free and Pro in the AEVION subscription · AEVION Constitution",
  description:
    "Free (5 сохранений, 10 AI-запросов в день) и Pro — безлимит, AI без лимита, clean PDF, embed — в подписке AEVION: все модули на срок от 1 до 12 месяцев, оплата за срок вперёд.",
  alternates: { canonical: `${SITE}/constitution/pricing` },
  openGraph: {
    title: "Constitution Pricing — Free / Pro",
    description: "Constitution as a Service. От бесплатного редактора до Pro в подписке AEVION.",
    url: `${SITE}/constitution/pricing`,
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
