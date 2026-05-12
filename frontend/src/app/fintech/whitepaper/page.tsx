import type { Metadata } from "next";
import Link from "next/link";

// Zone: aevion-core/main owns frontend/src/app/fintech/**

export const metadata: Metadata = {
  title: "AEVION Fintech Whitepaper — architecture, trust model, settlement spine",
  description:
    "Technical whitepaper for the AEVION fintech ecosystem: VeilNetX settlement layer, QMaskCard tokenization, QPayNet wallets, QGood transparency, Z-Tide reputation, QChainGov on-chain governance. Architecture, hash-chain integrity, JWT auth model, idempotency guarantees.",
  alternates: { canonical: "https://aevion.app/fintech/whitepaper" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech Whitepaper",
    description: "Architecture, trust model, settlement spine — 6 interlocking modules.",
    type: "article",
    url: "https://aevion.app/fintech/whitepaper",
  },
};

const C = {
  bg: "#0f172a", panel: "#1e293b", border: "#334155",
  text: "#f1f5f9", dim: "#94a3b8", faint: "#64748b",
  accent: "#a78bfa", green: "#34d399",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.02em", margin: "40px 0 12px" }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "24px 0 8px" }}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.7, color: C.dim, margin: "0 0 12px" }}>{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#a5f3fc" }}>{children}</code>;
}

export default function FintechWhitepaperPage() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/fintech" style={{ color: C.dim, textDecoration: "none" }}>Fintech</Link>
          {" / "}<span style={{ color: C.text }}>Whitepaper</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px" }}>
          AEVION Fintech Architecture
        </h1>
        <P>Version 1.0 · 2026-05-12 · 5 modules · 33+ REST endpoints · production-ready</P>

        {/* Abstract */}
        <div style={{ padding: "20px 24px", background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, margin: "24px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Abstract</div>
          <P>
            AEVION operates its own financial substrate — not as a layer-1 chain or a stablecoin,
            but as a verifiable accounting layer where every meaningful financial event in the
            platform is hash-linked and externally auditable. Five interlocking modules form the
            substrate: <strong style={{ color: C.text }}>VeilNetX</strong> (settlement),{" "}
            <strong style={{ color: C.text }}>QMaskCard</strong> (privacy),{" "}
            <strong style={{ color: C.text }}>QGood</strong> (transparency),{" "}
            <strong style={{ color: C.text }}>Z-Tide</strong> (reputation),{" "}
            <strong style={{ color: C.text }}>QChainGov</strong> (governance). Each is independently
            deployable but together they form a closed loop: contribution → reputation → governance → settlement.
          </P>
        </div>

        <H2>1. Settlement: VeilNetX</H2>
        <P>
          VeilNetX is an append-only, hash-chained ledger. Every entry contains a domain-specific
          payload (donation, charge, transfer, vote tally) plus a <Code>prevHash</Code> pointer
          to its parent. The current head is publicly queryable via <Code>GET /api/veilnetx-ledger/head</Code>.
          Participants are HMAC-blinded — readers see opaque identifiers, but the chain operator
          can resolve them with the secret key.
        </P>
        <H3>Integrity guarantees</H3>
        <P>
          The chain is verifiable end-to-end via <Code>GET /api/veilnetx-ledger/chain/verify</Code> which
          recomputes every <Code>prevHash</Code> from the current head back to genesis. Any tampering
          breaks the chain and is detected by external observers.
        </P>

        <H2>2. Privacy: QMaskCard</H2>
        <P>
          QMaskCard issues single-use or recurring virtual PANs. The real funding source (QPayNet wallet
          or Stripe card) stays hidden behind the mask. Per-mask spend caps, merchant locks, and TTL
          give holders surgical control. Every authorization fires a VeilNetX entry — masks are private
          to the merchant but auditable to the holder.
        </P>

        <H2>3. Transparency: QGood</H2>
        <P>
          QGood is charity infrastructure with cryptographic receipts. Each donation is hash-anchored
          on VeilNetX so neither the platform nor the campaign operator can quietly redirect funds.
          Donors get verifiable proof-of-contribution; recipients get a public ledger they can show
          to auditors.
        </P>

        <H2>4. Reputation: Z-Tide</H2>
        <P>
          Z-Tide is a soft, decaying reputation layer. Every meaningful action — login streak, helpful
          comment, Bureau certification, QGood donation — emits a weighted event. The aggregate score
          unlocks ranks: <Code>seedling</Code> → <Code>current</Code> → <Code>wave</Code> → <Code>stream</Code> →{" "}
          <Code>tide</Code> → <Code>river</Code> → <Code>ocean</Code>. Downstream modules gate features
          on rank thresholds.
        </P>

        <H2>5. Governance: QChainGov</H2>
        <P>
          QChainGov runs proposal lifecycle + voting. Proposals carry a vote mode (yes/no/abstain,
          ranked-choice, or weighted), quorum, and pass threshold. One vote per user per proposal is
          enforced by a UNIQUE database constraint. Passed proposals can trigger admin-gated execution
          via <Code>POST /api/qchaingov/proposals/:id/execute</Code>.
        </P>

        <H2>6. Cross-Module Loop</H2>
        <P>
          The modules form a circular reinforcement: donations on QGood → reputation bump on Z-Tide →
          eligibility for QChainGov votes → settlement of treasury moves on VeilNetX → optionally
          funded via QMaskCard for privacy. Every step is observable; nothing is hidden between modules.
        </P>

        <H2>7. Trust Model</H2>
        <H3>What is trustless</H3>
        <P>
          Chain integrity (VeilNetX hashes), donation receipts (QGood VeilNetX entries), proposal
          counts (QChainGov UNIQUE constraint), mask non-reuse (QMaskCard single-use TTL).
        </P>
        <H3>What is trusted</H3>
        <P>
          The platform operator (AEVION) for: identity assertions (JWT issuance), Stripe ↔ ledger
          bridge (fund inflow), and admin lifecycle (proposal open/close, campaign approval).
        </P>

        <H2>8. Observability</H2>
        <P>
          Every module exposes <Code>/health</Code> (uptime + dependencies) and <Code>/stats</Code>{" "}
          (aggregate counters). The <Link href="/fintech/dashboard" style={{ color: C.accent }}>/fintech/dashboard</Link>{" "}
          page polls all 5 in real time. CI runs three daily smoke tests against production:{" "}
          <Code>fintech-prod-smoke</Code> (21 read-only checks),{" "}
          <Code>fintech-cross-module-smoke</Code> (7-step flow audit), and{" "}
          <Code>fintech-flow-smoke</Code> (full E2E cross-product chain).
        </P>

        {/* Next steps */}
        <div style={{ marginTop: 48, padding: "20px 24px", background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 10 }}>See also</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/fintech" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>→ Fintech Ecosystem Overview</Link>
            <Link href="/fintech/dashboard" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>→ Live Dashboard</Link>
            <Link href="/fintech/status" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>→ Status Page</Link>
            <Link href="/developers/fintech" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>→ Developer API Reference</Link>
            <Link href="/developers/fintech/quickstart" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>→ Quickstart (6 curl examples)</Link>
          </div>
        </div>

        <footer style={{ marginTop: 40, fontSize: 11, color: C.faint, textAlign: "center" }}>
          AEVION Fintech v1.0 · 2026 · Whitepaper subject to revision.
        </footer>
      </article>
    </main>
  );
}
