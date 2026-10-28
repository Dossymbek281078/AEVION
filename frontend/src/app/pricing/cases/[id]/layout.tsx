import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

interface CaseSummary {
  id: string;
  customer: string;
  hook: string;
  industry: string;
  region: string;
  tier: string;
}

async function fetchCase(id: string): Promise<CaseSummary | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/pricing/cases/${id}`, { cache: "force-cache" });
    if (!r.ok) return null;
    return (await r.json()) as CaseSummary;
  } catch {
    return null;
  }
}

/**
 * 🔴 28.10.2026 (Sentry JAVASCRIPT-NEXTJS-2, прод 981c23da8): «Page changed from static to
 * dynamic at runtime /pricing/cases/<id>, reason: headers» — страница кейса отдавала 500.
 * Здесь стоял generateStaticParams (SSG + dynamicParams), а родительский
 * src/app/pricing/layout.tsx с 27.10 читает язык читателя через cookies()/headers()
 * (getServerLang). Статически собранный маршрут не имеет права трогать заголовки
 * на запросе — Next роняет страницу целиком. Денежная страница: кейсы ведут в кассу.
 *
 * Решение: маршрут кейса — динамический (SSR на запрос), как и весь /pricing под этим
 * layout; page.tsx и так грузит кейс клиентским fetch. Сторож:
 * src/app/__tests__/staticSegmentPodDinamicheskimLayout.guard.test.ts.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await fetchCase(id);
  if (!c) {
    return {
      title: "Кейс не найден — AEVION",
      alternates: { canonical: `/pricing/cases/${id}` },
    };
  }
  const title = `${c.customer} — кейс AEVION`;
  const description = c.hook;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://aevion.app/pricing/cases/${c.id}`,
      siteName: "AEVION",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `/pricing/cases/${c.id}`,
    },
  };
}

export default function PricingCaseDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
