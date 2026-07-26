import type { ReactNode } from "react";
import type { Metadata } from "next";
import { apiUrl } from "@/lib/apiBase";

/**
 * Link preview for a single listing.
 *
 * The listing page itself renders on the client, so a shared link used to
 * preview as the generic exchange title — a founder sending their idea to an
 * investor got a card that said nothing about the idea. This resolves the real
 * title, tier and asking terms on the server so the link carries them.
 *
 * Never throws: a listing page must open even when the backend is unreachable,
 * so a failed lookup falls back to the generic title instead of an error.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

const TIER_LABEL: Record<string, string> = {
  idea: "Только идея",
  mvp: "Идея + MVP",
  product: "Готовый продукт",
};

function usd(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(n)}`;
}

interface DealTerms {
  intent?: string;
  askUsd?: number;
  equityOfferedPct?: number;
  askingPriceUsd?: number;
  stakeForSalePct?: number;
  stakePriceUsd?: number;
}

/** The one line an investor should see in the preview: what is on offer. */
function dealLine(deal: DealTerms | null | undefined): string | null {
  if (!deal) return null;
  if (deal.intent === "raise" && deal.askUsd && deal.equityOfferedPct) {
    return `${usd(deal.askUsd)} за ${deal.equityOfferedPct}%`;
  }
  if (deal.intent === "sell_stake" && deal.stakePriceUsd && deal.stakeForSalePct) {
    return `${deal.stakeForSalePct}% за ${usd(deal.stakePriceUsd)}`;
  }
  if (deal.intent === "sell_full" && deal.askingPriceUsd) {
    return `Продажа целиком — ${usd(deal.askingPriceUsd)}`;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const url = `${SITE}/startup-exchange/${id}`;
  const fallback: Metadata = {
    title: "Заявка на бирже стартапов · AEVION",
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };

  try {
    const resp = await fetch(apiUrl(`/api/startupx/ideas/${encodeURIComponent(id)}`), {
      // A listing changes when the founder edits terms; an hour-old preview is
      // fine and keeps this off the backend on every crawl.
      next: { revalidate: 3600 },
    });
    if (!resp.ok) return fallback;
    const body = (await resp.json()) as { success?: boolean; data?: Record<string, unknown> };
    const l = body?.data;
    if (!body?.success || !l || typeof l.title !== "string") return fallback;

    // hasOwnProperty, not `?? `: TIER_LABEL["constructor"] is a function, and a
    // function interpolated into a <title> renders as its source code.
    const tierKey = String(l.tier);
    const tier = Object.prototype.hasOwnProperty.call(TIER_LABEL, tierKey) ? TIER_LABEL[tierKey] : "Заявка";
    const deal = dealLine(l.deal as DealTerms | null);
    const score = typeof l.assessment_score === "number" ? `${l.assessment_score}/100` : null;
    const summary = typeof l.description === "string" ? l.description.replace(/\s+/g, " ").slice(0, 180) : "";

    const title = `${l.title} — ${tier}${deal ? `, ${deal}` : ""} · Биржа стартапов AEVION`;
    const description = [deal, score ? `балл разбора ${score}` : null, summary]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300);

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { type: "article", url, title, description, siteName: "AEVION" },
      robots: { index: true, follow: true },
    };
  } catch {
    return fallback;
  }
}

export default function ListingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
