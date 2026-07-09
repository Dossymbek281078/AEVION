import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { ResultView, VERDICT_LABEL, type AnalysisResult, type Verdict } from "../../_result";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadAnalysis(id: string): Promise<AnalysisResult | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/qventure/analyses/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.ok ? (j.data as AnalysisResult) : null;
  } catch {
    return null;
  }
}

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch { /* headers unavailable at build time */ }
  return "";
}

function memoSnippet(memo: string, max = 180): string {
  const t = memo.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await loadAnalysis(id);
  if (!a) {
    return { title: "QVenture analysis — AEVION", robots: { index: false, follow: false } };
  }
  const verdict = VERDICT_LABEL[a.verdict as Verdict] ?? a.verdict.toUpperCase();
  const title = `${a.name} — ${a.composite}/100 · ${verdict} · QVenture`;
  const description = memoSnippet(a.result.council.memo);
  const origin = await getOrigin();
  const ogPath = `/api/og/module/${encodeURIComponent(id)}?title=${encodeURIComponent(a.name)}`
    + `&subtitle=${encodeURIComponent(memoSnippet(a.result.council.memo, 120))}`
    + `&tag=${encodeURIComponent("QVenture")}`
    + `&status=${encodeURIComponent(`${verdict} · ${a.composite}/100`)}`;
  const ogImage = origin ? `${origin}${ogPath}` : ogPath;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SharedAnalysisPage({ params }: Props) {
  const { id } = await params;
  const a = await loadAnalysis(id);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        {!a ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Analysis not found</h1>
            <p style={{ color: "#64748b", marginTop: 8 }}>This QVenture report doesn&apos;t exist or is no longer public.</p>
            <Link href="/qventure" style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "#7c3aed", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
              Run a new analysis →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", letterSpacing: 1, textTransform: "uppercase" }}>
                AEVION · QVenture · shared report
              </div>
              <Link href="/qventure" style={{ padding: "9px 18px", background: "#7c3aed", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
                Run your own analysis →
              </Link>
            </div>
            <ResultView result={a} shared />
            <div style={{ marginTop: 8, padding: "18px 20px", borderRadius: 14, background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Analyze any company in any sector with QVenture</div>
              <Link href="/qventure" style={{ display: "inline-block", padding: "10px 22px", background: "#7c3aed", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
                Get a fund-grade memo →
              </Link>
            </div>
          </>
        )}
      </ProductPageShell>
    </>
  );
}
