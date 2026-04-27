import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

const FALLBACK_TITLE = "AEVION Digital IP Bureau — Public Certificate Registry";
const FALLBACK_DESC =
  "Public, verifiable registry of cryptographically protected works. SHA-256 + Ed25519 + Shamir Secret Sharing, anchored to a Merkle root the world can audit. Backed by the Berne Convention, WIPO, TRIPS, eIDAS and ESIGN.";

// Live numbers in OG/Twitter copy let the social card brag about real
// scale ("12,847 certificates · 38,219 verifications · 47 countries"),
// while the page itself stays a static client component for fast TTFB.
type Totals = {
  certificates?: number;
  verifications?: number;
  authorsApprox?: number;
  countriesApprox?: number;
};

async function fetchTotals(): Promise<Totals | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/pipeline/bureau/stats`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const j = await res.json();
    if (j && typeof j === "object" && j.totals && typeof j.totals === "object") {
      return j.totals as Totals;
    }
    return null;
  } catch {
    return null;
  }
}

function liveLine(t: Totals | null): string | null {
  if (!t) return null;
  const parts: string[] = [];
  if (typeof t.certificates === "number") parts.push(`${t.certificates.toLocaleString()} certificates`);
  if (typeof t.verifications === "number") parts.push(`${t.verifications.toLocaleString()} verifications`);
  if (typeof t.countriesApprox === "number") parts.push(`${t.countriesApprox} countries`);
  return parts.length ? parts.join(" · ") : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const totals = await fetchTotals();
  const live = liveLine(totals);
  const title = FALLBACK_TITLE;
  const description = live
    ? `${live}. SHA-256 + Ed25519 + Shamir Secret Sharing, anchored to a public Merkle root. Search, verify, embed.`
    : FALLBACK_DESC;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "AEVION Digital IP Bureau",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function BureauLayout({ children }: { children: React.ReactNode }) {
  return children;
}
