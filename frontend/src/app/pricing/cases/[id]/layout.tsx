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
