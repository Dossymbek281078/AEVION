import Link from "next/link";
import type { Metadata } from "next";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { serverFetch } from "@/lib/apiBase";

// Public showcase. A visitor should be able to watch the tool decide — on an
// easy plan and on one where the evidence is contracts, clearances or offtake
// instead of ARR, which is where a screening tool usually stops working. The
// verdicts are public; the reasoning behind them is not.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Worked examples — business plans from easy to hard",
  description:
    "See QVenture decide on real-shaped business plans: straightforward SaaS, marketplaces quoted in GMV, defence programmes with contracted backlog, therapeutics with a trial phase. Verdicts public; the full reasoning behind sign-in.",
  alternates: { canonical: "/qventure/showcase" },
};

interface ShowcaseItem {
  id: string;
  slug: string;
  name: string;
  sector: string;
  stage: string;
  complexity: "simple" | "medium" | "complex";
  whyThisOne: string;
  composite: number;
  verdict: "invest" | "watch" | "pass";
  signalCoveragePct: number | null;
  redFlagCount: number;
}

const VERDICT: Record<string, { c: string; label: string }> = {
  invest: { c: "#0a7d72", label: "INVEST" },
  watch: { c: "#b7791f", label: "WATCH" },
  pass: { c: "#b5241b", label: "PASS" },
};

const GROUPS: Array<{ key: ShowcaseItem["complexity"]; title: string; blurb: string }> = [
  { key: "simple", title: "Straightforward", blurb: "Metrics are stated plainly — revenue, growth, retention. The easy end." },
  { key: "medium", title: "Needs unpicking", blurb: "Volume rather than seats, annual rather than monthly, euros rather than dollars." },
  { key: "complex", title: "Hard cases", blurb: "No ARR to read. Contracted backlog, a cleared trial phase, an executed offtake, design wins." },
];

export default async function ShowcasePage() {
  let items: ShowcaseItem[] = [];
  try {
    const r = await serverFetch("/api/qventure/showcase", { cache: "no-store" });
    const j = r ? await r.json() : null;
    if (j?.ok && Array.isArray(j.data)) items = j.data as ShowcaseItem[];
  } catch { /* render the empty state rather than a crash */ }

  return (
    <ProductPageShell>
      <Wave1Nav />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 64px" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.14em", fontWeight: 800, color: "var(--teal, #0a7d72)" }}>
          AEVION · QVENTURE
        </div>
        <h1 style={{ fontSize: 34, margin: "6px 0 10px", fontWeight: 800 }}>Worked examples</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-soft, #45474c)", maxWidth: 760 }}>
          {items.length} plans put through the same engine, ordered by score and grouped by how hard
          they are to read. Every verdict below is a real output — nothing here is hand-set. The
          reasoning behind each one (factor breakdown, the four-role council, entry strategy and the
          diligence panels) opens with an account.
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-faint, #74767c)", maxWidth: 760 }}>
          Companies are fictional and described plausibly; none impersonates a real business.
          Screening signal, not investment advice.
        </p>

        {items.length === 0 && (
          <div style={{ marginTop: 28, padding: 18, border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 10 }}>
            The showcase is being seeded — it runs each plan through the live engine on deploy.
            Check back in a few minutes, or <Link href="/qventure" style={{ color: "var(--teal, #0a7d72)" }}>analyse your own plan</Link>.
          </div>
        )}

        {GROUPS.map((g) => {
          const group = items.filter((i) => i.complexity === g.key);
          if (!group.length) return null;
          return (
            <section key={g.key} style={{ marginTop: 34 }}>
              <h2 style={{ fontSize: 21, margin: "0 0 4px", fontWeight: 800 }}>{g.title}</h2>
              <div style={{ fontSize: 13.5, color: "var(--ink-faint, #74767c)", marginBottom: 14 }}>{g.blurb}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                {group.map((it) => {
                  const v = VERDICT[it.verdict] ?? VERDICT.watch;
                  return (
                    <Link
                      key={it.id}
                      href={`/qventure/showcase/${it.slug}`}
                      style={{
                        display: "block", textDecoration: "none", color: "inherit",
                        border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 12,
                        padding: "16px 18px", background: "var(--card, #fffefb)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontSize: 17, fontWeight: 800 }}>{it.name}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: v.c }}>{it.composite}</div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-faint, #74767c)", marginTop: 2 }}>
                        {it.sector} · {it.stage}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, background: v.c, color: "#fff", fontSize: 11.5, fontWeight: 800 }}>
                          {v.label}
                        </span>
                        {it.signalCoveragePct !== null && (
                          <span style={{ fontSize: 12, color: "var(--ink-soft, #45474c)" }}>{it.signalCoveragePct}% on company evidence</span>
                        )}
                        {it.redFlagCount > 0 && (
                          <span style={{ fontSize: 12, color: "#b45309" }}>{it.redFlagCount} red flag{it.redFlagCount > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft, #45474c)" }}>
                        {it.whyThisOne}
                      </p>
                      <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--teal, #0a7d72)" }}>
                        See the conclusions →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/qventure" style={{ padding: "11px 18px", borderRadius: 8, background: "var(--teal, #0a7d72)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            Analyse your own plan →
          </Link>
          <Link href="/qventure/batch" style={{ padding: "11px 18px", borderRadius: 8, border: "1px solid var(--rule-mid, #b9b8b0)", fontWeight: 700, textDecoration: "none", color: "inherit" }}>
            Rank a folder of decks
          </Link>
        </div>
      </main>
    </ProductPageShell>
  );
}
