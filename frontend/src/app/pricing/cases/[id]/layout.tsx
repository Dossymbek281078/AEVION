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
 * SSG — pre-render каждого case при build. Если backend недоступен на момент
 * build (например в CI без бека) — fallback к dynamic, страницы будут
 * генерироваться по запросу. Это безопасно: page.tsx уже умеет рендерить
 * клиентский fetch.
 */
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  try {
    const r = await fetch(`${getApiBase()}/api/pricing/cases`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: Array<{ id: string }> };
    return (j.items ?? []).map((c) => ({ id: c.id }));
  } catch {
    return [];
  }
}

/** Принимать любые id — даже которых не было на момент build (новые кейсы). */
export const dynamicParams = true;

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
      url: `https://aevion.io/pricing/cases/${c.id}`,
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
