import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { serverFetch } from "@/lib/apiBase";
import { UnlockPanel } from "./_unlock";

// Conclusions are public; the work behind them is not. The split is enforced by
// the API (GET /showcase/:slug returns the teaser without a Bearer token), so
// this page renders what it is given rather than hiding fields it received.

export const dynamic = "force-dynamic";

interface Teaser {
  id: string;
  slug: string;
  name: string;
  sector: string;
  stage: string;
  geography?: string;
  complexity: "simple" | "medium" | "complex";
  whyThisOne: string;
  composite: number;
  verdict: "invest" | "watch" | "pass";
  signalCoveragePct: number | null;
  redFlagCount: number;
  rubricVersion: number | null;
  locked: string[];
}

const VERDICT: Record<string, { c: string; label: string; reading: string }> = {
  invest: { c: "#0a7d72", label: "INVEST", reading: "Clears the bar for a lead ticket at this stage." },
  watch: { c: "#b7791f", label: "WATCH", reading: "Worth tracking, not yet worth leading — the plan leaves specific things unproven." },
  pass: { c: "#b5241b", label: "PASS", reading: "Does not clear the bar on the evidence disclosed." },
};

const COMPLEXITY: Record<string, string> = {
  simple: "Straightforward plan",
  medium: "Needs unpicking",
  complex: "Hard case",
};

async function load(slug: string): Promise<Teaser | null> {
  try {
    const r = await serverFetch(`/api/qventure/showcase/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = r ? await r.json() : null;
    return j?.ok ? (j.data as Teaser) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await load(slug);
  if (!t) return { title: "Worked example — QVenture" };
  return {
    title: `${t.name} — ${t.composite}/100 · ${t.verdict.toUpperCase()}`,
    description: `${t.whyThisOne} Verdict and score are public; the full reasoning opens with an account.`,
    alternates: { canonical: `/qventure/showcase/${t.slug}` },
  };
}

export default async function ShowcaseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await load(slug);
  if (!t) notFound();

  const v = VERDICT[t.verdict] ?? VERDICT.watch;
  const SECTION: React.CSSProperties = {
    border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 12,
    padding: "18px 20px", background: "var(--card, #fffefb)", marginTop: 18,
  };

  return (
    <ProductPageShell>
      <Wave1Nav />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 64px" }}>
        <Link href="/qventure/showcase" style={{ fontSize: 13, color: "var(--teal, #0a7d72)", textDecoration: "none" }}>
          ← All worked examples
        </Link>

        <div style={SECTION}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 30, margin: "0 0 4px", fontWeight: 800 }}>{t.name}</h1>
              <div style={{ fontSize: 13.5, color: "var(--ink-faint, #74767c)" }}>
                {t.sector} · {t.stage}{t.geography ? ` · ${t.geography}` : ""} · {COMPLEXITY[t.complexity] ?? ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: v.c, lineHeight: 1 }}>{t.composite}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint, #74767c)" }}>/ 100</div>
              <span style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 999, background: v.c, color: "#fff", fontSize: 12, fontWeight: 800 }}>
                {v.label}
              </span>
            </div>
          </div>
        </div>

        <div style={SECTION}>
          <h2 style={{ fontSize: 19, margin: "0 0 10px", fontWeight: 800 }}>Conclusions</h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, lineHeight: 1.75, color: "var(--ink-soft, #45474c)" }}>
            <li><b>{v.label}</b> — {v.reading}</li>
            {t.signalCoveragePct !== null && (
              <li>
                <b>{t.signalCoveragePct}%</b> of the score rests on this company&apos;s own disclosed
                evidence; the rest comes from sector reference data.
              </li>
            )}
            <li>
              {t.redFlagCount === 0
                ? "No red flags were raised against the figures disclosed."
                : `${t.redFlagCount} red flag${t.redFlagCount > 1 ? "s were" : " was"} raised against the figures disclosed.`}
            </li>
            <li>{t.whyThisOne}</li>
            {t.rubricVersion !== null && (
              <li style={{ color: "var(--ink-faint, #74767c)" }}>
                Scored by rubric v{t.rubricVersion} — scores are only comparable within a version.
              </li>
            )}
          </ul>
        </div>

        <UnlockPanel slug={t.slug} locked={t.locked} />

        <p style={{ marginTop: 22, fontSize: 12.5, color: "var(--ink-faint, #74767c)" }}>
          Fictional company, described plausibly; nothing here impersonates a real business.
          Screening signal, not investment advice.
        </p>
      </main>
    </ProductPageShell>
  );
}
