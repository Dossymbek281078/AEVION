import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { serverFetch } from "@/lib/apiBase";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import paper from "@/styles/aevionPaper.module.css";
import { ResultView, VERDICT_LABEL, SERIF, type AnalysisResult, type Verdict } from "../../_result";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadAnalysis(id: string): Promise<AnalysisResult | null> {
  try {
    // Retries a cold backend so a deploy-time render doesn't 404 a real report.
    const res = await serverFetch(`/api/qventure/analyses/${encodeURIComponent(id)}`);
    if (!res || !res.ok) return null;
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

  // Image is intentionally omitted here: the co-located opengraph-image.tsx
  // renders the newspaper card (name · verdict · composite) and Next injects it
  // into both og:image and twitter:image automatically. Setting images here would
  // override it with the generic /api/og/module card.
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedAnalysisPage({ params }: Props) {
  const { id } = await params;
  const a = await loadAnalysis(id);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
       <div className={paper.paper} style={{ background: "transparent", minHeight: 0 }}>
        {!a ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 800, color: "var(--ink, #17181a)" }}>Разбор не найден</h1>
            <p style={{ color: "var(--ink-faint, #74767c)", marginTop: 8 }}>This QVenture report doesn&apos;t exist or is no longer public.</p>
            <Link href="/qventure" style={{ display: "inline-block", marginTop: 16, padding: "11px 20px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, textDecoration: "none" }}>
              Новый разбор →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, borderTop: "3px solid var(--rule-bold, #17181a)", paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: "0.28em", textTransform: "uppercase" }}>
                AEVION · QVenture · общий отчёт
              </div>
              <Link href="/qventure" style={{ padding: "10px 18px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
                Свой разбор →
              </Link>
            </div>
            <ResultView result={a} shared />
            <div style={{ marginTop: 8, padding: "20px", borderRadius: 4, background: "var(--ink, #17181a)", color: "var(--card, #fffefb)", textAlign: "center" }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Разбор любой компании в любой отрасли — QVenture</div>
              <Link href="/qventure" style={{ display: "inline-block", padding: "11px 22px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, textDecoration: "none" }}>
                Инвестиционное резюме →
              </Link>
            </div>
          </>
        )}
       </div>
      </ProductPageShell>
    </>
  );
}
