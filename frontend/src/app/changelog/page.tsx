import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

type Entry = {
  date: string;
  highlight: string;
  body: string;
  modules?: string[];
  kind: "feat" | "fix" | "docs";
};

const ENTRIES: Entry[] = [
  {
    date: "2026-04-27",
    highlight: "Bank story pages · Trust deep-dive · Receipts · Wallet card · Security model",
    body:
      "Five new indexable surfaces shipped: /bank/about (story), /bank/trust (factor breakdown + tier ladder + methodology), /bank/receipt/[id] (printable Ed25519-signed receipts with verify QR), /bank/card (virtual card whose tier follows Trust Score, flip + hide-balance + print), /bank/security (5-layer defence model + comparison table + FAQ). Each ships with locale-aware copy in EN/RU/KK and an edge-rendered OG image (1200×630). Story group surfaced in /bank/explore so the catalog reads narrative-first. Spend Forecast component, Smart Notifications Center, Multichat token meter and demo seed mode also landed in this push.",
    modules: ["Bank", "Multichat"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "Multichat Engine goes live · Awards real submission UX · Demo refresh · Pitch evolution",
    body:
      "Multichat Engine moves from beta to live with a working parallel-agent grid (6 roles, persistent local sessions, 5 LLM providers, demo-mode fallback). Awards Music + Film get real submission forms, voting with rank #1/2/3 medals and AEC payout banners. /demo gains live ecosystem pulse and a 90-second pipeline timeline; /demo/deep gets a full technical rewrite (architecture, crypto stack, threat model, performance budgets, deployment, multilingual). /pitch picks up Customer voice quotes, Partners & press, Walkthroughs, plus a print-optimised /pitch/print route for PDF export.",
    modules: ["Multichat", "Awards", "Demo", "Pitch"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "Investor pitch tour at /pitch · PitchValueCallout on every live module · 10-session launcher",
    body:
      "Full investor narrative shipped: thesis, $340B TAM, 4 network forces, 12 launched modules grouped by value bucket, 15 emerging nodes, 5-axis defensibility, 4-phase GTM, ARR trajectory through year 5, ask. Investor FAQ added to /help. Live API metrics in the hero. PowerShell launcher (START_SESSIONS.ps1) opens 10 Claude Code sessions across 6 worktrees with a single command.",
    modules: ["Pitch", "Help", "Tooling"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "AEVION Bank — full multilingual MVP (EN / RU / KZ)",
    body:
      "Global i18n extended with Kazakh; ~700+ translation keys across 36 components; 12 hover tooltips on key metrics; backend wiring (Bearer auth, ApiError class, email→accountId resolver, BackendStatus offline banner); 13 _lib files become i18n-aware via *_KEY maps. /bank rendered as static, build green.",
    modules: ["Bank", "i18n"],
    kind: "feat",
  },
  {
    date: "2026-04-25",
    highlight: "Bank: 10 product features in one push",
    body:
      "Financial Copilot, Autopilot rules #1–#5, Panic Freeze, Wealth Constellation, Concept Primer, Tier Progression, Unified Audit Feed, holographic QR Share, ⌘K command palette, mobile bottom tabs.",
    modules: ["Bank"],
    kind: "feat",
  },
  {
    date: "2026-04-25",
    highlight: "Qright v3 — full stack on main",
    body:
      "Shamir Secret Sharing + One-Time Signatures + HMAC rotation + author co-signing (WebCrypto + IndexedDB) + offline verification bundle independent of AEVION. PRs #1, #4, #6 merged.",
    modules: ["QRight"],
    kind: "feat",
  },
];

export const metadata = {
  title: "AEVION · Changelog",
  description: "Recent shipped product updates across all AEVION modules.",
};

export default function ChangelogPage() {
  return (
    <main style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh", padding: "32px 24px 80px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Wave1Nav variant="dark" />
        <p
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(148,163,184,0.95)",
            margin: "0 0 12px",
          }}
        >
          What we shipped recently
        </p>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 900,
            margin: "0 0 18px",
            letterSpacing: "-0.03em",
            background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AEVION changelog
        </h1>
        <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 36px" }}>
          Notable updates only. The git log is the unfiltered source of truth — see{" "}
          <a href="https://github.com/Dossymbek281078/AEVION/commits/bank-payment-layer" style={{ color: "#5eead4" }}>
            commits/bank-payment-layer
          </a>{" "}
          on GitHub.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {ENTRIES.map((e, i) => {
            const kindColor = e.kind === "feat" ? "#5eead4" : e.kind === "fix" ? "#fbbf24" : "#94a3b8";
            const kindLabel = e.kind === "feat" ? "FEATURE" : e.kind === "fix" ? "FIX" : "DOCS";
            return (
              <article
                key={i}
                style={{
                  padding: 22,
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.7)",
                  border: `1px solid ${kindColor}33`,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: kindColor,
                      background: `${kindColor}18`,
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {kindLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.05em" }}>{e.date}</span>
                  {e.modules?.map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#cbd5e1",
                        background: "rgba(148,163,184,0.1)",
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.25)",
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: "0 0 8px", lineHeight: 1.35 }}>
                  {e.highlight}
                </h2>
                <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.65, margin: 0 }}>{e.body}</p>
              </article>
            );
          })}
        </div>

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid rgba(51,65,85,0.5)", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 12px" }}>
            For the investor view, see{" "}
            <Link href="/pitch" style={{ color: "#fbbf24", fontWeight: 700 }}>
              /pitch
            </Link>
            . For a product walkthrough,{" "}
            <Link href="/demo" style={{ color: "#5eead4" }}>
              /demo
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
