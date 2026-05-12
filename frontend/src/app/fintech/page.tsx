import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION Fintech Ecosystem — settlement, masking, wallets, charity, reputation, governance",
  description:
    "AEVION runs its own financial fabric: VeilNetX settlement ledger, QMaskCard payment masking, QPayNet wallets, QGood transparent charity, Z-Tide adaptive reputation, and QChainGov on-chain governance — all interlinked, all observable in real time.",
  alternates: { canonical: "https://aevion.app/fintech" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech Ecosystem",
    description:
      "Six interlocking fintech modules powering the AEVION planet — one settlement spine, one reputation surface, one governance loop.",
    url: "https://aevion.app/fintech",
    siteName: "AEVION",
    images: [
      {
        url: "https://aevion.app/fintech/opengraph-image",
        width: 1200,
        height: 630,
        alt: "AEVION Fintech Ecosystem",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Fintech Ecosystem",
    description:
      "VeilNetX · QMaskCard · QPayNet · QGood · Z-Tide · QChainGov — one financial fabric, six surfaces.",
    images: ["https://aevion.app/fintech/opengraph-image"],
  },
};

// -----------------------------
// Types for backend stats shapes
// -----------------------------

type QPayStats = {
  totalWallets?: number;
  activeWallets?: number;
  totalTransactions?: number;
  totalVolumeKzt?: number;
  totalDepositedKzt?: number;
} & Record<string, unknown>;

type QGoodStats = {
  total_campaigns?: number;
  active_campaigns?: number;
  total_raised_cents?: number;
  total_donors?: number;
} & Record<string, unknown>;

type QMaskStats = {
  active_masks?: number;
  total_masks?: number;
  authorized_charges?: number;
  declined_charges?: number;
  volume_cents?: number;
} & Record<string, unknown>;

type VeilLedgerStats = {
  total?: number;
  perModule?: Array<{ module: string; entries: number; volume_cents?: number }>;
} & Record<string, unknown>;

type VeilChainHead = {
  head?: string | null;
  length?: number;
  tipAt?: string | null;
} & Record<string, unknown>;

type ZTideStats = {
  active_users?: number;
  total_events?: number;
  total_weight?: number | string;
  top_score?: number | string | null;
  ranks?: Array<{ id: string; label: string; min: number }>;
} & Record<string, unknown>;

type QChainGovStats = {
  total_proposals?: number;
  open_proposals?: number;
  closed_proposals?: number;
  total_votes?: number;
  unique_voters?: number;
} & Record<string, unknown>;

// -----------------------------
// Resilient loaders
// -----------------------------

async function safeJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${getApiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// -----------------------------
// Formatters
// -----------------------------

function fmtInt(n: number | undefined | null): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

function fmtMoneyFromCents(cents: number | undefined | null): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(2)}`;
}

function fmtMoneyFromKzt(kzt: number | undefined | null): string {
  if (typeof kzt !== "number" || !Number.isFinite(kzt)) return "—";
  if (kzt >= 1_000_000) return `${(kzt / 1_000_000).toFixed(2)}M ₸`;
  if (kzt >= 1_000) return `${(kzt / 1_000).toFixed(1)}K ₸`;
  return `${kzt.toFixed(0)} ₸`;
}

function shortHash(h: string | null | undefined): string {
  if (!h || typeof h !== "string") return "—";
  if (h.length <= 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

// -----------------------------
// Style palette
// -----------------------------

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  panelSoft: "#172033",
  border: "#334155",
  borderSoft: "#1f2a3d",
  text: "#f1f5f9",
  textDim: "#94a3b8",
  textFaint: "#64748b",
  veil: "#a78bfa",       // VeilNetX
  mask: "#c4b5fd",       // QMaskCard (sister lavender, slightly lighter)
  pay: "#06b6d4",        // QPayNet
  good: "#34d399",       // QGood
  ztide: "#fbbf24",      // Z-Tide
  gov: "#f472b6",        // QChainGov
};

// -----------------------------
// Module definitions (static + live)
// -----------------------------

type ModuleCard = {
  key: string;
  emoji: string;
  name: string;
  tagline: string;
  accent: string;
  body: string;
  statLabel: string;
  statValue: string;
  cta: { href: string; label: string };
};

function buildModules(args: {
  veilHead: VeilChainHead | null;
  veilLedger: VeilLedgerStats | null;
  qmask: QMaskStats | null;
  qpay: QPayStats | null;
  qgood: QGoodStats | null;
  ztide: ZTideStats | null;
  qchain: QChainGovStats | null;
}): ModuleCard[] {
  const { veilHead, veilLedger, qmask, qpay, qgood, ztide, qchain } = args;

  return [
    {
      key: "veilnetx",
      emoji: "🌀",
      name: "VeilNetX",
      tagline: "Settlement layer",
      accent: C.veil,
      body:
        "An append-only, hash-linked ledger that records every financial movement across AEVION. Donations, mask authorisations, wallet transfers and treasury votes anchor here. The chain is internal — not a public layer-1 — but every entry is independently verifiable, and the running head can be quoted in any external audit.",
      statLabel: "Chain length",
      statValue: fmtInt(veilHead?.length ?? veilLedger?.total ?? null),
      cta: { href: "/veilnetx/ledger", label: "Open ledger →" },
    },
    {
      key: "qmaskcard",
      emoji: "🪪",
      name: "QMaskCard",
      tagline: "Payment masking",
      accent: C.mask,
      body:
        "Single-use and recurring virtual card masks generated on demand. Merchants see a unique PAN per transaction; the real funding source stays hidden. Spending caps, merchant locks and instant kill switches give holders surgical control, and every authorisation lands as a VeilNetX entry for auditability.",
      statLabel: "Active masks",
      statValue: fmtInt(qmask?.active_masks ?? null),
      cta: { href: "/qmaskcard/dashboard", label: "Open dashboard →" },
    },
    {
      key: "qpaynet",
      emoji: "💳",
      name: "QPayNet",
      tagline: "Wallet rails",
      accent: C.pay,
      body:
        "Multi-wallet KZT accounts with P2P transfers, payment requests, merchant API keys, and Stripe-backed top-ups. QPayNet is the entry point for end users into the AEVION economy — it funds donations to QGood, settles QMaskCard charges, and pays out QBuild bounties. Every move is observable, throttled, and idempotent.",
      statLabel: "Wallets",
      statValue: fmtInt(qpay?.totalWallets ?? qpay?.activeWallets ?? null),
      cta: { href: "/qpaynet", label: "Open QPayNet →" },
    },
    {
      key: "qgood",
      emoji: "💚",
      name: "QGood",
      tagline: "Transparent charity",
      accent: C.good,
      body:
        "Donations with receipts you can verify. Every campaign publishes its inflow ledger; every contribution is anchored on VeilNetX so neither the platform nor the operator can quietly redirect funds. Recurring giving, anonymous mode, and proof-of-impact reports turn philanthropy into infrastructure, not a black box.",
      statLabel: "Total raised",
      statValue: fmtMoneyFromCents(qgood?.total_raised_cents ?? null),
      cta: { href: "/qgood/campaigns", label: "Browse campaigns →" },
    },
    {
      key: "ztide",
      emoji: "🌊",
      name: "Z-Tide",
      tagline: "Adaptive reputation",
      accent: C.ztide,
      body:
        "A soft, non-transferable reputation score that rises with real ecosystem actions — Bureau certifications, QBuild hires, QGood donations, referrals. Z-Tide is read-only signal: it informs interest rates, KYC tiers and visibility, but cannot be bought, sold, or staked. Decay keeps it honest; transparency keeps it earned.",
      statLabel: "Active contributors",
      statValue: fmtInt(ztide?.active_users ?? null),
      cta: { href: "/z-tide/leaderboard", label: "See leaderboard →" },
    },
    {
      key: "qchaingov",
      emoji: "🏛",
      name: "QChainGov",
      tagline: "On-chain governance",
      accent: C.gov,
      body:
        "Open proposals on treasury allocations, fee parameters and module roadmaps. Voting weight is derived from a blend of token holdings and Z-Tide reputation, so capital alone cannot capture decisions. Every vote, quorum and outcome is anchored on VeilNetX — the same spine that records the money it governs.",
      statLabel: "Open proposals",
      statValue: fmtInt(qchain?.open_proposals ?? null),
      cta: { href: "/qchaingov/proposals", label: "Open governance →" },
    },
  ];
}

// -----------------------------
// Pulse pills
// -----------------------------

type Pulse = { label: string; sub: string; accent: string; href: string };

function buildPulse(args: {
  veilHead: VeilChainHead | null;
  ztide: ZTideStats | null;
  qgood: QGoodStats | null;
  qmask: QMaskStats | null;
  qchain: QChainGovStats | null;
  qpay: QPayStats | null;
}): Pulse[] {
  const out: Pulse[] = [];
  const { veilHead, ztide, qgood, qmask, qchain, qpay } = args;

  if (typeof veilHead?.length === "number") {
    out.push({
      label: `${fmtInt(veilHead.length)} settlement entries`,
      sub: `head ${shortHash(veilHead.head)}`,
      accent: C.veil,
      href: "/veilnetx/ledger",
    });
  }
  if (typeof ztide?.active_users === "number") {
    out.push({
      label: `${fmtInt(ztide.active_users)} contributors`,
      sub: "Z-Tide signal",
      accent: C.ztide,
      href: "/z-tide/leaderboard",
    });
  }
  if (typeof qgood?.total_raised_cents === "number") {
    out.push({
      label: `${fmtMoneyFromCents(qgood.total_raised_cents)} raised`,
      sub: `${fmtInt(qgood.total_donors ?? 0)} donors`,
      accent: C.good,
      href: "/qgood/campaigns",
    });
  }
  if (typeof qmask?.active_masks === "number") {
    out.push({
      label: `${fmtInt(qmask.active_masks)} virtual masks`,
      sub: `${fmtInt(qmask.authorized_charges ?? 0)} auths`,
      accent: C.mask,
      href: "/qmaskcard/dashboard",
    });
  }
  if (typeof qchain?.open_proposals === "number") {
    out.push({
      label: `${fmtInt(qchain.open_proposals)} open votes`,
      sub: `${fmtInt(qchain.total_proposals ?? 0)} total`,
      accent: C.gov,
      href: "/qchaingov/proposals",
    });
  }
  const walletCount = qpay?.totalWallets ?? qpay?.activeWallets;
  if (typeof walletCount === "number") {
    out.push({
      label: `${fmtInt(walletCount)} wallets`,
      sub: typeof qpay?.totalDepositedKzt === "number" ? fmtMoneyFromKzt(qpay.totalDepositedKzt) : "QPayNet",
      accent: C.pay,
      href: "/qpaynet",
    });
  }
  return out;
}

// -----------------------------
// Small UI atoms
// -----------------------------

function PulsePill({ p }: { p: Pulse }) {
  return (
    <Link
      href={p.href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 14px",
        borderRadius: 999,
        background: "#0b1426",
        border: `1px solid ${p.accent}55`,
        color: C.text,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: p.accent }}>{p.label}</span>
      <span style={{ fontSize: 11, color: C.textFaint, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {p.sub}
      </span>
    </Link>
  );
}

function ModuleCardView({ m }: { m: ModuleCard }) {
  return (
    <Link
      href={m.cta.href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 20,
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        minWidth: 280,
        maxWidth: 520,
        flex: "1 1 380px",
        minHeight: 240,
        textDecoration: "none",
        color: C.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${m.accent}10 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${m.accent}22`,
            border: `1px solid ${m.accent}55`,
            borderRadius: 10,
            fontSize: 18,
          }}
        >
          {m.emoji}
        </span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{m.name}</span>
          <span style={{ fontSize: 11, color: m.accent, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {m.tagline}
          </span>
        </div>
      </div>

      <p style={{ position: "relative", fontSize: 13, lineHeight: 1.55, color: C.textDim, margin: 0 }}>
        {m.body}
      </p>

      <div
        style={{
          position: "relative",
          marginTop: "auto",
          paddingTop: 12,
          borderTop: `1px solid ${C.borderSoft}`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: m.accent, lineHeight: 1 }}>{m.statValue}</span>
          <span style={{ fontSize: 11, color: C.textFaint, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {m.statLabel}
          </span>
        </div>
        <span style={{ fontSize: 12, color: m.accent, fontWeight: 700 }}>{m.cta.label}</span>
      </div>
    </Link>
  );
}

function FlowRow({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        background: C.panelSoft,
        border: `1px solid ${C.borderSoft}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.55,
        color: C.textDim,
      }}
    >
      <span aria-hidden style={{ color: accent, fontWeight: 900, marginTop: 1 }}>→</span>
      <span>{children}</span>
    </li>
  );
}

// -----------------------------
// Structured data
// -----------------------------

function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://aevion.app/#website",
        url: "https://aevion.app",
        name: "AEVION",
        description: "The AEVION planet — a self-contained network of fintech, identity, build and learning modules.",
        publisher: { "@id": "https://aevion.app/#org" },
      },
      {
        "@type": "Organization",
        "@id": "https://aevion.app/#org",
        name: "AEVION",
        url: "https://aevion.app",
        sameAs: [
          "https://github.com/Dossymbek281078/AEVION",
        ],
        description:
          "AEVION operates an interlocking financial fabric — VeilNetX settlement, QMaskCard masking, QPayNet wallets, QGood charity, Z-Tide reputation, QChainGov governance.",
      },
      {
        "@type": "WebPage",
        url: "https://aevion.app/fintech",
        name: "AEVION Fintech Ecosystem",
        isPartOf: { "@id": "https://aevion.app/#website" },
        about: { "@id": "https://aevion.app/#org" },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// -----------------------------
// Page
// -----------------------------

export default async function FintechHubPage() {
  const [qpay, qgood, qmask, veilLedger, veilHead, ztide, qchain] = await Promise.all([
    safeJson<QPayStats>("/api/qpaynet/stats"),
    safeJson<QGoodStats>("/api/qgood/stats"),
    safeJson<QMaskStats>("/api/qmaskcard/stats"),
    safeJson<VeilLedgerStats>("/api/veilnetx-ledger/stats"),
    safeJson<VeilChainHead>("/api/veilnetx-ledger/chain/head"),
    safeJson<ZTideStats>("/api/ztide/stats"),
    safeJson<QChainGovStats>("/api/qchaingov/stats"),
  ]);

  const modules = buildModules({ veilHead, veilLedger, qmask, qpay, qgood, ztide, qchain });
  const pulse = buildPulse({ veilHead, ztide, qgood, qmask, qchain, qpay });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <StructuredData />

      {/* ---------- HERO ---------- */}
      <section
        style={{
          padding: "64px 24px 32px",
          background:
            "radial-gradient(1100px 500px at 20% 0%, rgba(167,139,250,0.18) 0%, transparent 60%), radial-gradient(900px 400px at 90% 10%, rgba(6,182,212,0.14) 0%, transparent 60%), linear-gradient(180deg, #0b1226 0%, #0f172a 100%)",
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Link
            href="/"
            style={{
              fontSize: 12,
              color: C.textDim,
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            ← AEVION
          </Link>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              marginTop: 18,
              borderRadius: 999,
              background: "#0b1426",
              border: `1px solid ${C.veil}55`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.veil,
            }}
          >
            <span aria-hidden>✺</span>
            AEVION · Fintech Ecosystem
          </div>

          <h1
            style={{
              fontSize: 48,
              lineHeight: 1.05,
              fontWeight: 900,
              margin: "22px 0 14px",
              letterSpacing: "-0.02em",
              maxWidth: 920,
            }}
          >
            Financial infrastructure for the AEVION planet.
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: C.textDim,
              maxWidth: 760,
              margin: 0,
            }}
          >
            One settlement spine, one reputation surface, one governance loop — split across six interlocking modules.
            Every wallet move, mask charge, donation and vote lands on the same ledger, so what users see and what
            auditors see is the same set of facts.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <Link
              href="/developers/fintech"
              style={{
                padding: "12px 22px",
                background: C.veil,
                color: "#0b0820",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                textDecoration: "none",
                border: `1px solid ${C.veil}`,
              }}
            >
              Read whitepaper
            </Link>
            <Link
              href="/qchaingov/proposals"
              style={{
                padding: "12px 22px",
                background: "transparent",
                color: C.text,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                textDecoration: "none",
                border: `1px solid ${C.border}`,
              }}
            >
              Open governance
            </Link>
            <Link
              href="/fintech/modules"
              style={{ padding: "12px 22px", background: "transparent", color: C.text, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: "none", border: `1px solid ${C.border}` }}
            >
              All 6 modules →
            </Link>
            <Link
              href="/fintech/catalog"
              style={{ padding: "12px 22px", background: "transparent", color: C.text, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: "none", border: `1px solid ${C.border}` }}
            >
              Live catalog (27+) →
            </Link>
            <Link
              href="/fintech/compare"
              style={{ padding: "12px 22px", background: "transparent", color: C.text, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: "none", border: `1px solid ${C.border}` }}
            >
              Compare tiers →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- LIVE PULSE BAR ---------- */}
      <section style={{ padding: "24px 24px 8px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.textFaint,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Live pulse · refreshes on every request
          </div>
          {pulse.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                background: C.panelSoft,
                border: `1px dashed ${C.border}`,
                borderRadius: 12,
                color: C.textFaint,
                fontSize: 13,
              }}
            >
              Live metrics are warming up. The page still renders fully — refresh once backend nodes report in.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {pulse.map((p) => (
                <PulsePill key={p.label} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- MODULE CARDS ---------- */}
      <section style={{ padding: "32px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            Six modules, one fabric
          </h2>
          <p style={{ fontSize: 13, color: C.textDim, margin: "0 0 22px", maxWidth: 720 }}>
            Each module is independently usable and independently observable. Each one writes to the same VeilNetX
            chain, so cross-product flows reconcile without trust.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            {modules.map((m) => (
              <ModuleCardView key={m.key} m={m} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CROSS-PRODUCT FLOW ---------- */}
      <section style={{ padding: "24px 24px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            How the modules talk
          </h2>
          <p style={{ fontSize: 13, color: C.textDim, margin: "0 0 18px", maxWidth: 720 }}>
            The interesting part is not any one module — it&apos;s how a single user action ripples across all six.
            A donation, for example, touches the wallet, the mask, the chain, the reputation score and the public
            campaign ledger in a single pass.
          </p>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <FlowRow accent={C.pay}>
              <b style={{ color: C.text }}>User</b> opens a <b style={{ color: C.pay }}>QPayNet</b> wallet, tops up via
              Stripe or P2P. Every deposit, transfer and withdrawal is idempotent and emits a wallet-event.
            </FlowRow>
            <FlowRow accent={C.veil}>
              That wallet-event is anchored as a <b style={{ color: C.veil }}>VeilNetX</b> entry — append-only,
              hash-linked, queryable by any module. The chain head is the canonical truth.
            </FlowRow>
            <FlowRow accent={C.ztide}>
              Settlement entries feed <b style={{ color: C.ztide }}>Z-Tide</b> as weighted reputation signal. Donations
              and confirmed merchant payments raise the score; chargebacks and disputes lower it. The score is read-only.
            </FlowRow>
            <FlowRow accent={C.good}>
              When the user donates to a <b style={{ color: C.good }}>QGood</b> campaign, funds route through the same
              wallet → chain path. The campaign&apos;s public ledger is a filtered view of VeilNetX, not a separate
              source of truth.
            </FlowRow>
            <FlowRow accent={C.mask}>
              <b style={{ color: C.mask }}>QMaskCard</b> charges deduct from the wallet, generate a one-time PAN for the
              merchant, and anchor the authorisation on the chain — so receipts, refunds and disputes all reference the
              same entry.
            </FlowRow>
            <FlowRow accent={C.gov}>
              <b style={{ color: C.gov }}>QChainGov</b> proposals vote on treasury allocations and fee parameters.
              Voting weight blends token holdings with Z-Tide reputation; outcomes are anchored on the same VeilNetX
              spine that records the money they govern.
            </FlowRow>
          </ol>
        </div>
      </section>

      {/* ---------- FOR DEVELOPERS ---------- */}
      <section style={{ padding: "24px 24px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              padding: 22,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div style={{ maxWidth: 480, minWidth: 280, flex: "1 1 280px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.veil,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                For developers
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                Build on the same chain we run on.
              </h2>
              <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, margin: "0 0 14px" }}>
                Every fintech surface above ships with an OpenAPI spec, a shared event library and a live smoke suite.
                You can read the chain head, subscribe to events, or push your own entries through partner keys.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  href="/developers/fintech"
                  style={{
                    display: "inline-block",
                    padding: "10px 18px",
                    background: C.veil,
                    color: "#0b0820",
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    textDecoration: "none",
                  }}
                >
                  Go to developer hub →
                </Link>
                <Link
                  href="/developers/fintech/quickstart"
                  style={{
                    display: "inline-block",
                    padding: "10px 18px",
                    background: "transparent",
                    color: C.veil,
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    textDecoration: "none",
                    border: `1px solid ${C.veil}66`,
                  }}
                >
                  ⚡ Quickstart →
                </Link>
                <Link
                  href="/fintech/dashboard"
                  style={{
                    display: "inline-block",
                    padding: "10px 18px",
                    background: "transparent",
                    color: C.text,
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    textDecoration: "none",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  📊 Live Dashboard
                </Link>
              </div>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 280,
                flex: "1 1 360px",
              }}
            >
              {[
                "OpenAPI spec — 33 endpoints across 5 modules",
                "Cross-product event lib (ecosystemEvents.ts)",
                "Stripe go-live verifier",
                "Smoke test suite (5 fintech smokes)",
              ].map((line) => (
                <li
                  key={line}
                  style={{
                    padding: "10px 12px",
                    background: C.panelSoft,
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: 10,
                    fontSize: 13,
                    color: C.textDim,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span aria-hidden style={{ color: C.veil, fontWeight: 900 }}>›</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer
        style={{
          padding: "32px 24px 48px",
          borderTop: `1px solid ${C.borderSoft}`,
          background: "#0a1120",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12 }}>
              <Link href="/veilnetx" style={{ color: C.veil, textDecoration: "none" }}>VeilNetX</Link>
              <Link href="/qmaskcard" style={{ color: C.mask, textDecoration: "none" }}>QMaskCard</Link>
              <Link href="/qpaynet" style={{ color: C.pay, textDecoration: "none" }}>QPayNet</Link>
              <Link href="/qgood" style={{ color: C.good, textDecoration: "none" }}>QGood</Link>
              <Link href="/z-tide" style={{ color: C.ztide, textDecoration: "none" }}>Z-Tide</Link>
              <Link href="/qchaingov" style={{ color: C.gov, textDecoration: "none" }}>QChainGov</Link>
            </div>
            <div style={{ fontSize: 11, color: C.textFaint }}>
              aevion.app / fintech
            </div>
          </div>

          <p style={{ fontSize: 11, lineHeight: 1.6, color: C.textFaint, margin: 0, maxWidth: 920 }}>
            <b style={{ color: C.textDim }}>Disclaimers.</b> VeilNetX is an internal settlement ledger, not a layer-1
            blockchain — entries are signed and hash-linked, but consensus is operated by AEVION, not by an open
            validator set. Z-Tide is a soft reputation signal, not a transferable asset; it cannot be sold, staked,
            or lent. AEV is a separate token with its own emission curve, governance role and on-chain identity; it
            is not interchangeable with Z-Tide score or QPayNet KZT balances. Nothing on this page is investment
            advice or an offer to sell securities.
          </p>
        </div>
      </footer>
    </main>
  );
}
