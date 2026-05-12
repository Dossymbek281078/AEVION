import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Fintech API — Developer reference",
  description:
    "REST reference for the AEVION fintech ecosystem: QPayNet, QMaskCard, VeilNetX-Ledger, Z-Tide, QChainGov, QGood. 33+ endpoints, shared JWT, PostgreSQL-backed, production-ready. Curl examples, env vars, cross-product hooks.",
  alternates: { canonical: "/developers/fintech" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech API — Developer reference",
    description:
      "33 REST endpoints across 5 modules. Shared JWT auth. PostgreSQL-backed. Production-ready.",
    type: "article",
    siteName: "AEVION",
    url: "/developers/fintech",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Fintech API",
    description:
      "REST reference for 6 fintech modules. Curl examples, auth model, env vars.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Style constants — inline-only, dark theme.
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_BG = "#0f172a";
const CARD_BG = "#1e293b";
const CARD_BORDER = "#334155";
const MONO_BG = "#020617";
const TEXT_PRIMARY = "#e2e8f0";
const TEXT_MUTED = "#94a3b8";
const ACCENT_PURPLE = "#a78bfa";
const ACCENT_GREEN = "#34d399";
const ACCENT_RED = "#f87171";
const ACCENT_AMBER = "#f59e0b";
const ACCENT_BLUE = "#60a5fa";
const ACCENT_CYAN = "#22d3ee";

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS_FONT =
  "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable presentational components.
// ─────────────────────────────────────────────────────────────────────────────
function MethodPill({ method }: { method: string }) {
  const map: Record<string, string> = {
    GET: ACCENT_GREEN,
    POST: ACCENT_PURPLE,
    PATCH: ACCENT_BLUE,
    PUT: ACCENT_BLUE,
    DELETE: ACCENT_AMBER,
  };
  const bg = map[method] ?? "#64748b";
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 56,
        textAlign: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        color: "#020617",
        background: bg,
        fontFamily: MONO_FONT,
      }}
    >
      {method}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: MONO_FONT,
        fontSize: 13,
        color: ACCENT_PURPLE,
        background: "rgba(167,139,250,0.08)",
        border: "1px solid rgba(167,139,250,0.2)",
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontFamily: MONO_FONT,
        fontSize: 13,
        lineHeight: 1.55,
        color: TEXT_PRIMARY,
        background: MONO_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "14px 16px",
        margin: "12px 0",
        overflowX: "auto",
        whiteSpace: "pre",
      }}
    >
      {children}
    </pre>
  );
}

function SectionTitle({
  children,
  color,
  id,
}: {
  children: React.ReactNode;
  color: string;
  id?: string;
}) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 26,
        fontWeight: 700,
        marginTop: 56,
        marginBottom: 12,
        color,
        letterSpacing: -0.3,
        scrollMarginTop: 24,
      }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 14,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: TEXT_MUTED,
        margin: "22px 0 8px",
      }}
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.65,
        color: TEXT_PRIMARY,
        margin: "8px 0",
      }}
    >
      {children}
    </p>
  );
}

function EndpointTable({
  rows,
}: {
  rows: { method: string; path: string; desc: string }[];
}) {
  return (
    <div
      style={{
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        overflow: "hidden",
        margin: "10px 0",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: MONO_FONT,
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ background: "#0b1220" }}>
            <th
              style={{
                textAlign: "left",
                padding: "10px 12px",
                color: TEXT_MUTED,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                borderBottom: `1px solid ${CARD_BORDER}`,
                width: 80,
              }}
            >
              Method
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "10px 12px",
                color: TEXT_MUTED,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                borderBottom: `1px solid ${CARD_BORDER}`,
                minWidth: 280,
              }}
            >
              Path
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "10px 12px",
                color: TEXT_MUTED,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                borderBottom: `1px solid ${CARD_BORDER}`,
              }}
            >
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.method}-${r.path}-${i}`}
              style={{
                borderBottom:
                  i === rows.length - 1 ? "none" : `1px solid ${CARD_BORDER}`,
              }}
            >
              <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                <MethodPill method={r.method} />
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: TEXT_PRIMARY,
                  verticalAlign: "top",
                  wordBreak: "break-all",
                }}
              >
                {r.path}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: TEXT_MUTED,
                  verticalAlign: "top",
                  fontFamily: SANS_FONT,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {r.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetaCard({
  label,
  items,
  tone,
}: {
  label: string;
  items: React.ReactNode[];
  tone: "auth" | "env" | "hook";
}) {
  const accent =
    tone === "auth" ? ACCENT_BLUE : tone === "env" ? ACCENT_CYAN : ACCENT_GREEN;
  return (
    <div
      style={{
        background: "rgba(2,6,23,0.45)",
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: "12px 14px",
        margin: "10px 0",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: accent,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          color: TEXT_PRIMARY,
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        {items.map((it, i) => (
          <li key={i} style={{ margin: "2px 0" }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page.
// ─────────────────────────────────────────────────────────────────────────────
export default function FintechDevPage() {
  return (
    <main
      style={{
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        minHeight: "100vh",
        fontFamily: SANS_FONT,
        padding: "48px 24px 96px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* ─────────── Hero ─────────── */}
        <header style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: ACCENT_PURPLE,
              fontFamily: MONO_FONT,
              marginBottom: 12,
            }}
          >
            developers / fintech
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.1,
              margin: "0 0 14px",
              color: "#fff",
            }}
          >
            AEVION Fintech API
            <span style={{ color: ACCENT_PURPLE }}> — Developer reference</span>
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: TEXT_MUTED,
              margin: 0,
              maxWidth: 720,
            }}
          >
            33+ REST endpoints across 6 modules. Shared JWT auth. PostgreSQL-backed.
            Production-ready and live on{" "}
            <Code>api.aevion.app</Code>.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 18,
              fontFamily: MONO_FONT,
              fontSize: 12,
            }}
          >
            {[
              { l: "QPayNet", c: ACCENT_PURPLE },
              { l: "QMaskCard", c: ACCENT_CYAN },
              { l: "VeilNetX-Ledger", c: ACCENT_GREEN },
              { l: "Z-Tide", c: ACCENT_BLUE },
              { l: "QChainGov", c: ACCENT_AMBER },
              { l: "QGood", c: ACCENT_RED },
            ].map((m) => (
              <a
                key={m.l}
                href={`#${m.l.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                style={{
                  color: m.c,
                  textDecoration: "none",
                  border: `1px solid ${m.c}55`,
                  background: `${m.c}11`,
                  padding: "5px 10px",
                  borderRadius: 999,
                }}
              >
                {m.l}
              </a>
            ))}
          </div>
        </header>

        {/* ─────────── Quickstart ─────────── */}
        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: "20px 24px",
            margin: "24px 0",
          }}
        >
          <SubTitle>Quickstart</SubTitle>
          <P>
            <a href="/developers/fintech/quickstart" style={{ color: ACCENT_PURPLE, fontWeight: 700 }}>
              → Interactive quickstart: 6 curl examples with copy-buttons →
            </a>
            {" · "}
            <a href="/developers/fintech/sdk" style={{ color: ACCENT_PURPLE, fontWeight: 700 }}>
              SDK reference →
            </a>
            {" · "}
            <a href="/developers/fintech/webhooks" style={{ color: ACCENT_PURPLE, fontWeight: 700 }}>
              Webhooks →
            </a>
            {" · "}
            <a href="/developers/fintech/errors" style={{ color: ACCENT_PURPLE, fontWeight: 700 }}>
              Error codes →
            </a>
            {" · "}
            <a href="/developers/fintech/troubleshooting" style={{ color: ACCENT_PURPLE, fontWeight: 700 }}>
              Troubleshooting →
            </a>
          </P>
          <P>
            Every fintech module gates writes behind the platform JWT. Bootstrap a
            token once, then use it as <Code>Authorization: Bearer &lt;token&gt;</Code>{" "}
            on subsequent calls. Read endpoints are unauthenticated where the resource
            is public (campaign listings, chain head, leaderboards) and JWT-bound
            everywhere else.
          </P>
          <Pre>{`# 1. Register (or POST /api/auth/login if you already have an account)
curl -X POST https://api.aevion.app/api/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{ "email": "you@example.com", "password": "supersecret" }'

# Response: { "token": "<JWT>", "user": { "id": "...", "email": "..." } }

# 2. Export the token and call any fintech endpoint
export AEV_TOKEN='<JWT>'
curl https://api.aevion.app/api/qpaynet/me/dashboard \\
  -H "Authorization: Bearer $AEV_TOKEN"`}</Pre>

          <SubTitle>Conventions</SubTitle>
          <ul
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: TEXT_PRIMARY,
              margin: "4px 0 8px",
              paddingLeft: 20,
            }}
          >
            <li>
              All bodies and responses are JSON. <Code>Content-Type: application/json</Code>{" "}
              required on writes.
            </li>
            <li>
              Money is sent and returned in <strong>minor units</strong> (KZT
              tiyin, USD cents). Field name is <Code>amountKzt</Code> /{" "}
              <Code>amountCents</Code>; never floats.
            </li>
            <li>
              Idempotency: <Code>Idempotency-Key</Code> header on{" "}
              <Code>POST /qpaynet/transfer</Code>, <Code>/withdraw</Code>,{" "}
              <Code>/deposit</Code> &mdash; replays return the original transaction.
            </li>
            <li>
              Pagination: <Code>?cursor=&amp;limit=</Code> on list endpoints, capped
              at 200. Response includes <Code>nextCursor</Code> when more results
              exist.
            </li>
            <li>
              Rate limits: per-IP read 240/min, write 20-60/min, money-moving 30/min.
              <Code>429</Code> on overflow, <Code>RateLimit-*</Code> headers always
              present.
            </li>
            <li>
              Errors: <Code>{`{ "error": "code", "message": "..." }`}</Code> with
              accurate HTTP status (400 / 401 / 403 / 404 / 409 / 422 / 429 / 500).
            </li>
          </ul>
        </section>

        {/* ─────────── QPayNet ─────────── */}
        <SectionTitle id="qpaynet" color={ACCENT_PURPLE}>
          1. QPayNet &mdash; fiat wallet rails
        </SectionTitle>
        <P>
          End-to-end fiat wallet system with Stripe-backed deposits, P2P transfers,
          payouts, merchant charge API, payment requests with public pay pages,
          KYC, refunds, admin reconciliation, and a real-time SSE event stream.
          The largest fintech surface area in the platform &mdash; <Code>/api/qpaynet</Code>{" "}
          owns the ledger of record for KZT/USD.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <>
              <strong>JWT bearer</strong> on every owner-scoped route. Admin
              routes (<Code>/admin/*</Code>) additionally require the caller email
              to appear in <Code>QPAYNET_ADMIN_EMAILS</Code>.
            </>,
            <>
              <strong>Merchant API keys</strong> (issued via{" "}
              <Code>POST /merchant/keys</Code>) authenticate{" "}
              <Code>POST /merchant/charge</Code> via{" "}
              <Code>X-API-Key</Code> &mdash; no JWT needed for server-to-server
              billing.
            </>,
            <>
              <strong>Public pages</strong> &mdash; <Code>/wallets/:id/public</Code>,{" "}
              <Code>/requests/:token</Code> &mdash; are rate-limited but
              unauthenticated.
            </>,
            <>
              <strong>Stripe webhook</strong> &mdash; <Code>/deposit/webhook</Code>{" "}
              validates the <Code>Stripe-Signature</Code> header against{" "}
              <Code>QPAYNET_STRIPE_WEBHOOK_SECRET</Code>.
            </>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "POST", path: "/api/qpaynet/wallets", desc: "Create a wallet (one per currency per user)." },
            { method: "GET", path: "/api/qpaynet/wallets", desc: "List your wallets with balances." },
            { method: "GET", path: "/api/qpaynet/wallets/:id/public", desc: "Public-safe view of a wallet for receive links." },
            { method: "POST", path: "/api/qpaynet/deposit/checkout", desc: "Create a Stripe Checkout session for fiat top-up." },
            { method: "POST", path: "/api/qpaynet/deposit/webhook", desc: "Stripe-signed webhook that credits the wallet on payment_intent.succeeded." },
            { method: "POST", path: "/api/qpaynet/withdraw", desc: "Initiate an off-platform payout. Triggers VeilNetX entry + Z-Tide event." },
            { method: "POST", path: "/api/qpaynet/transfer", desc: "P2P transfer between two wallets. 0.1% platform fee, idempotent." },
            { method: "GET", path: "/api/qpaynet/transactions[.csv]", desc: "Paginated transaction history. CSV export available." },
            { method: "POST", path: "/api/qpaynet/merchant/keys", desc: "Issue a server-to-server API key for charge collection." },
            { method: "POST", path: "/api/qpaynet/merchant/charge", desc: "Charge a customer wallet using the merchant API key." },
            { method: "POST", path: "/api/qpaynet/requests", desc: "Create a payment-request link. Returns shareable token + pay URL." },
            { method: "POST", path: "/api/qpaynet/requests/:token/pay", desc: "Pay a request from the authenticated user's wallet." },
            { method: "POST", path: "/api/qpaynet/payouts", desc: "Request an external bank payout (admin-reviewed)." },
            { method: "POST", path: "/api/qpaynet/kyc/submit", desc: "Submit KYC docs to lift caps. Cached threshold $1m KZT/month." },
            { method: "POST", path: "/api/qpaynet/webhook-subs", desc: "Subscribe to balance/transfer/request events. HMAC-signed POSTs." },
            { method: "GET", path: "/api/qpaynet/me/dashboard", desc: "Aggregated wallet + tx + request snapshot for the current user." },
            { method: "GET", path: "/api/qpaynet/admin/audit", desc: "Append-only audit log of state changes (admin)." },
            { method: "GET", path: "/api/qpaynet/admin/reconcile", desc: "Reconcile Stripe charges vs internal ledger (admin)." },
            { method: "GET", path: "/api/qpaynet/admin/events", desc: "SSE stream of fintech events for ops dashboards." },
            { method: "GET", path: "/api/qpaynet/openapi.json", desc: "Auto-generated OpenAPI 3.0 spec for the whole router." },
            { method: "GET", path: "/api/qpaynet/health", desc: "Liveness + Postgres reachability + active wallet count." },
          ]}
        />

        <SubTitle>Example &mdash; P2P transfer with idempotency</SubTitle>
        <Pre>{`curl -X POST https://api.aevion.app/api/qpaynet/transfer \\
  -H "Authorization: Bearer $AEV_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: transfer-2026-05-10-001' \\
  -d '{
    "fromWalletId": "wal_8f2a...",
    "toEmail":      "alice@example.com",
    "amountKzt":    50000,
    "memo":         "Coffee debt"
  }'

# 200 OK
# {
#   "transactionId": "tx_b3c1...",
#   "feeKzt":         50,
#   "fromBalanceKzt": 1249950,
#   "toBalanceKzt":   620050,
#   "createdAt":      "2026-05-10T14:33:08Z"
# }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <><Code>STRIPE_SECRET_KEY</Code> &mdash; Stripe live/test secret for Checkout sessions.</>,
            <><Code>QPAYNET_STRIPE_WEBHOOK_SECRET</Code> &mdash; raw <Code>whsec_...</Code> for signature verification.</>,
            <><Code>QPAYNET_ADMIN_EMAILS</Code> &mdash; comma-separated allowlist for <Code>/admin/*</Code>.</>,
            <><Code>QPAYNET_DAILY_DEPOSIT_CAP</Code> (default 500000) &mdash; per-user daily KZT cap pre-KYC.</>,
            <><Code>QPAYNET_MAX_TRANSFER</Code> (default 100000) &mdash; per-tx KZT cap pre-KYC.</>,
            <><Code>QPAYNET_KYC_THRESHOLD</Code> (default 1000000) &mdash; monthly cumulative KZT before KYC mandatory.</>,
            <><Code>QPAYNET_PII_SALT</Code> &mdash; HMAC salt for redacted audit log lookups.</>,
            <><Code>SMTP_HOST</Code> / <Code>SMTP_USER</Code> / <Code>SMTP_PASS</Code> / <Code>SMTP_FROM</Code> &mdash; transaction email delivery.</>,
            <><Code>FRONTEND_URL</Code> &mdash; base URL embedded in receipt + request links.</>,
            <><Code>QPAYNET_ALERT_URL</Code> &mdash; webhook target for reconcile drift &gt; 0.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>
              <Code>POST /withdraw</Code> &mdash; emits VeilNetX-Ledger{" "}
              <Code>withdrawal</Code> entry + Z-Tide event{" "}
              <Code>qpaynet-payout</Code> (+3).
            </>,
            <>
              <Code>POST /transfer</Code> &mdash; emits VeilNetX-Ledger{" "}
              <Code>transfer</Code> entry; sender and receiver each receive
              Z-Tide <Code>qpaynet-active</Code> (+1).
            </>,
            <>
              <Code>POST /deposit/webhook</Code> on Stripe success &mdash; appends
              VeilNetX <Code>deposit</Code> entry + Z-Tide{" "}
              <Code>qpaynet-deposit</Code> (+2).
            </>,
          ]}
        />

        {/* ─────────── QMaskCard ─────────── */}
        <SectionTitle id="qmaskcard" color={ACCENT_CYAN}>
          2. QMaskCard &mdash; virtual payment masks
        </SectionTitle>
        <P>
          Meta-tokenization layer that sits between users and the real card rail.
          Each mask is a unique <Code>aev-mask-&lt;32hex&gt;</Code> sentinel with
          its own spend limit, optional merchant-lock or category-lock, and
          per-charge AI risk score. Merchants never see real PAN/CVV &mdash; the
          mask routes to QPayNet / Stripe for settlement.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <><strong>JWT bearer</strong> on every endpoint. Masks are bound to <Code>userId</Code> &mdash; no admin allowlist; users can only see and revoke their own masks.</>,
            <>Charges are authorized server-side by the merchant integration after fraud-score evaluation. Hard declines for risk &ge; 80.</>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "GET", path: "/api/qmaskcard/health", desc: "Liveness + DB reachability." },
            { method: "POST", path: "/api/qmaskcard/masks", desc: "Issue a virtual mask. Kinds: single-use, recurring, merchant-locked, category-locked." },
            { method: "GET", path: "/api/qmaskcard/masks", desc: "List your active masks with remaining balance." },
            { method: "POST", path: "/api/qmaskcard/masks/:id/revoke", desc: "Soft-revoke a mask. Subsequent charges declined." },
            { method: "POST", path: "/api/qmaskcard/charges", desc: "Authorize a charge against a mask. Computes AI risk score 0..100." },
            { method: "GET", path: "/api/qmaskcard/charges", desc: "List charges, optional ?maskId= filter." },
            { method: "GET", path: "/api/qmaskcard/stats", desc: "Roll-up: active masks, total spend, decline rate, mean risk score." },
          ]}
        />

        <SubTitle>Example &mdash; issue a merchant-locked mask</SubTitle>
        <Pre>{`curl -X POST https://api.aevion.app/api/qmaskcard/masks \\
  -H "Authorization: Bearer $AEV_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "label":            "Spotify monthly",
    "kind":             "merchant-locked",
    "lockedToMerchant": "spotify.com",
    "currency":         "USD",
    "spendLimitCents":  1200,
    "expiresAt":        "2027-01-01T00:00:00Z"
  }'

# 201 Created
# {
#   "id":              "msk_4f1a...",
#   "virtualPan":      "aev-mask-3c1f9a8e8b1c4d5e9f0a1b2c3d4e5f60",
#   "remainingCents":  1200,
#   "status":          "active"
# }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <>None mask-specific beyond shared <Code>DATABASE_URL</Code> and <Code>AUTH_JWT_SECRET</Code>. Settlement-side env (<Code>STRIPE_SECRET_KEY</Code>) lives in QPayNet.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>
              <Code>POST /charges</Code> when <Code>status: authorized</Code> &mdash;
              emits VeilNetX-Ledger <Code>mask-charge</Code> entry. Decremented
              balance settles via QPayNet wallet under the hood (when configured).
            </>,
            <>High-risk charges (score &ge; 70) emit a Z-Tide{" "}
              <Code>qmaskcard-risk-flag</Code> event (-2) on the merchant&apos;s userId.</>,
          ]}
        />

        {/* ─────────── VeilNetX Ledger ─────────── */}
        <SectionTitle id="veilnetx-ledger" color={ACCENT_GREEN}>
          3. VeilNetX-Ledger &mdash; settlement chain
        </SectionTitle>
        <P>
          Append-only, hash-chained ledger of every fintech state change across the
          platform. Each entry carries a SHA-256 of the previous head &mdash; tampering
          is detectable end-to-end via <Code>GET /chain/verify</Code>. The chain is
          the canonical evidence trail for audits, refunds, and compliance reviews.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <><strong>JWT bearer</strong> for <Code>POST /entries</Code> &mdash; only platform-internal services (called from inside other routers) emit entries; user code does not write directly.</>,
            <>Reads (<Code>/entries</Code>, <Code>/chain/head</Code>, <Code>/chain/verify</Code>, <Code>/stats</Code>) are public-safe and require no auth &mdash; tampering visibility is a feature.</>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "GET", path: "/api/veilnetx-ledger/health", desc: "Liveness + last entry timestamp." },
            { method: "POST", path: "/api/veilnetx-ledger/entries", desc: "Append a new entry. Computes prevHash chain link server-side." },
            { method: "GET", path: "/api/veilnetx-ledger/entries", desc: "List entries with ?kind= / ?actorUserId= / ?since= filters." },
            { method: "GET", path: "/api/veilnetx-ledger/entries/:id", desc: "Retrieve a single entry with its hash chain context." },
            { method: "GET", path: "/api/veilnetx-ledger/chain/head", desc: "Current head: id, hash, height, timestamp." },
            { method: "GET", path: "/api/veilnetx-ledger/chain/verify", desc: "Walks the chain start to head, returns first invalid link or { valid: true, height }." },
            { method: "GET", path: "/api/veilnetx-ledger/stats", desc: "Rolling 24h/7d/30d entry counts by kind." },
          ]}
        />

        <SubTitle>Example &mdash; verify chain integrity</SubTitle>
        <Pre>{`curl https://api.aevion.app/api/veilnetx-ledger/chain/verify

# 200 OK
# {
#   "valid":        true,
#   "height":       18429,
#   "headHash":     "9c2e8f...3b1a",
#   "verifiedAt":   "2026-05-10T14:35:22Z",
#   "msToVerify":   142
# }

# If tampered:
# { "valid": false, "brokenAt": 8112, "expectedPrevHash": "...", "foundPrevHash": "..." }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <><Code>VEILNETX_SALT</Code> &mdash; HMAC salt mixed into every hash. <strong>Required in production</strong> (process refuses to boot without it). Falls back to <Code>SHARD_HMAC_SECRET</Code> for legacy installs.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>Acts as the <strong>sink</strong>, not a source. Receives entries from QPayNet (deposit/withdraw/transfer), QMaskCard (charge), QGood (donation), QChainGov (proposal-close).</>,
            <>Bureau-grade certificate emission references <Code>chain/head</Code> at certificate-issue time as a notarization anchor.</>,
          ]}
        />

        {/* ─────────── Z-Tide ─────────── */}
        <SectionTitle id="z-tide" color={ACCENT_BLUE}>
          4. Z-Tide &mdash; reputation layer
        </SectionTitle>
        <P>
          Cross-product reputation system. Every user has a single <Code>score</Code>{" "}
          (signed int) and a rank label (<Code>seedling / sprout / steady / strong / titan</Code>).
          Events from any module add weighted deltas; ranks promote/demote at fixed
          thresholds. Designed for inbound writes from the platform &mdash; not directly
          from user code.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <><strong>Service-key OR admin JWT</strong> for <Code>POST /events</Code>. Service mode: <Code>X-ZTide-Service-Key: $ZTIDE_SERVICE_KEY</Code>. Admin mode: caller email in <Code>ZTIDE_ADMIN_EMAILS</Code>.</>,
            <><strong>Open reads</strong>: <Code>/leaderboard</Code>, <Code>/rank/:userId</Code>, <Code>/stats</Code> are public.</>,
            <><Code>GET /me</Code> requires a JWT bearer &mdash; returns the caller&apos;s score with recent events.</>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "GET", path: "/api/ztide/health", desc: "Liveness + ranked-user count." },
            { method: "POST", path: "/api/ztide/events", desc: "Ingest a reputation event { userId, kind, sourceModule, weight, meta }." },
            { method: "GET", path: "/api/ztide/me", desc: "Authenticated user's score, rank, last 50 events." },
            { method: "GET", path: "/api/ztide/leaderboard", desc: "Top scores. ?limit= up to 100, ?rank= filter, ?since= window." },
            { method: "GET", path: "/api/ztide/rank/:userId", desc: "Public rank + score for a user (no PII)." },
            { method: "GET", path: "/api/ztide/stats", desc: "Distribution: count per rank, mean/median score, events ingested 24h." },
          ]}
        />

        <SubTitle>Example &mdash; ingest a reputation event (service-key mode)</SubTitle>
        <Pre>{`curl -X POST https://api.aevion.app/api/ztide/events \\
  -H "X-ZTide-Service-Key: $ZTIDE_SERVICE_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "userId":        "usr_8a2f1b...",
    "kind":          "qpaynet-payout",
    "sourceModule":  "qpaynet",
    "weight":        3,
    "meta":          { "transactionId": "tx_b3c1...", "amountKzt": 50000 }
  }'

# 201 Created
# {
#   "eventId":      "evt_4f1a...",
#   "newScore":     142,
#   "previousRank": "sprout",
#   "newRank":      "steady",
#   "promoted":     true
# }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <><Code>ZTIDE_SERVICE_KEY</Code> &mdash; 32+ char secret for backend-to-backend ingestion. Compared with <Code>crypto.timingSafeEqual</Code>.</>,
            <><Code>ZTIDE_ADMIN_EMAILS</Code> &mdash; comma-separated allowlist that can ingest events via JWT instead of service key.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>Pure <strong>sink</strong>. Every other fintech module ingests events here on state changes (transfer, deposit, donation, vote, mask-charge). Score promotions are surfaced back to the user dashboard via the QPayNet notifications router.</>,
          ]}
        />

        {/* ─────────── QChainGov ─────────── */}
        <SectionTitle id="qchaingov" color={ACCENT_AMBER}>
          5. QChainGov &mdash; on-chain governance
        </SectionTitle>
        <P>
          Proposal-vote-execute lifecycle for protocol/treasury/module/partnership
          decisions. Three vote modes: <Code>yes-no-abstain</Code>,{" "}
          <Code>ranked-choice</Code>, <Code>weighted</Code>. Proposals lock at
          <Code>open</Code>, tally at <Code>close</Code>, append an entry to
          VeilNetX-Ledger on outcome.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <><strong>JWT bearer</strong> for all writes. Anyone can <Code>POST /proposals</Code> (as draft); <Code>open</Code> and <Code>close</Code> require <Code>QCHAINGOV_ADMIN_EMAILS</Code>.</>,
            <>One vote per <Code>(proposalId, userId)</Code>; idempotency enforced at the unique index level.</>,
            <>Reads are public: anyone can list proposals, view votes-so-far, see results.</>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "GET", path: "/api/qchaingov/health", desc: "Liveness + open-proposal count." },
            { method: "POST", path: "/api/qchaingov/proposals", desc: "Create a draft proposal: title, summary, body, category, voteMode, quorum, threshold." },
            { method: "GET", path: "/api/qchaingov/proposals", desc: "List with ?status= / ?category= / ?authorUserId= filters." },
            { method: "GET", path: "/api/qchaingov/proposals/:id", desc: "Single proposal with current tally and vote breakdown." },
            { method: "POST", path: "/api/qchaingov/proposals/:id/votes", desc: "Cast a vote. Body shape depends on voteMode." },
            { method: "POST", path: "/api/qchaingov/proposals/:id/open", desc: "Admin: move draft to open. Sets votesOpenAt / votesCloseAt." },
            { method: "POST", path: "/api/qchaingov/proposals/:id/close", desc: "Admin: tally votes, set executed/rejected, append VeilNetX entry." },
            { method: "GET", path: "/api/qchaingov/proposals/:id/votes", desc: "Per-voter ballots for closed proposals (public, no PII besides userId)." },
            { method: "GET", path: "/api/qchaingov/stats", desc: "Total proposals by status, mean turnout, top categories." },
          ]}
        />

        <SubTitle>Example &mdash; cast a yes-no-abstain vote</SubTitle>
        <Pre>{`curl -X POST https://api.aevion.app/api/qchaingov/proposals/prop_8c1a2f/votes \\
  -H "Authorization: Bearer $AEV_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "choice": "yes",
    "reason": "Aligns with the treasury policy ratified Q1 2026."
  }'

# 201 Created
# {
#   "voteId":      "vote_a1b2c3...",
#   "tallyNow":    { "yes": 87, "no": 12, "abstain": 3 },
#   "quorumMet":   true,
#   "passing":     true
# }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <><Code>QCHAINGOV_ADMIN_EMAILS</Code> &mdash; comma-separated allowlist that can <Code>/open</Code> and <Code>/close</Code> proposals.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>
              <Code>POST /proposals/:id/close</Code> &mdash; emits VeilNetX-Ledger{" "}
              <Code>governance-decision</Code> entry with full tally + Z-Tide{" "}
              <Code>qchaingov-author</Code> (+5 if proposal passed, +1 if rejected
              with quorum, 0 if no quorum).
            </>,
            <>
              <Code>POST /proposals/:id/votes</Code> &mdash; emits Z-Tide{" "}
              <Code>qchaingov-voter</Code> (+1) on first vote of the proposal.
            </>,
          ]}
        />

        {/* ─────────── QGood ─────────── */}
        <SectionTitle id="qgood" color={ACCENT_RED}>
          6. QGood &mdash; charity campaigns
        </SectionTitle>
        <P>
          Public campaign listings with admin moderation, donations via QPayNet
          wallets, transparent on-chain donation receipts (VeilNetX entry per
          donation). Bonus 6th module &mdash; reuses the platform&apos;s identity and
          fintech rails rather than running parallel infra.
        </P>

        <MetaCard
          tone="auth"
          label="Auth model"
          items={[
            <><strong>Public reads</strong> &mdash; <Code>GET /campaigns</Code> and <Code>GET /campaigns/:id</Code> need no auth. Used for the marketing site.</>,
            <><strong>JWT bearer</strong> for <Code>POST /campaigns</Code> (anyone can propose) and <Code>POST /campaigns/:id/donations</Code> (donor must be authenticated).</>,
            <><Code>POST /campaigns/:id/approve</Code> requires caller email in <Code>QGOOD_ADMIN_EMAILS</Code> &mdash; otherwise campaigns stay <Code>pending</Code> and invisible to public reads.</>,
          ]}
        />

        <SubTitle>Key endpoints</SubTitle>
        <EndpointTable
          rows={[
            { method: "GET", path: "/api/qgood/health", desc: "Liveness + active-campaign count." },
            { method: "GET", path: "/api/qgood/campaigns", desc: "Public list of approved campaigns. ?category= / ?status= / cursor pagination." },
            { method: "GET", path: "/api/qgood/campaigns/:id", desc: "Single campaign with progress, recent donors (opt-in), media." },
            { method: "POST", path: "/api/qgood/campaigns", desc: "Propose a campaign. Returns id with status=pending until admin approves." },
            { method: "POST", path: "/api/qgood/campaigns/:id/approve", desc: "Admin: flip pending → active. Optionally pin or feature." },
            { method: "POST", path: "/api/qgood/campaigns/:id/donations", desc: "Donate from a QPayNet wallet. Settles atomically + emits VeilNetX receipt." },
            { method: "GET", path: "/api/qgood/stats", desc: "Total raised across campaigns, top causes, donor count." },
          ]}
        />

        <SubTitle>Example &mdash; donate to an active campaign</SubTitle>
        <Pre>{`curl -X POST https://api.aevion.app/api/qgood/campaigns/cmp_2f1a8b/donations \\
  -H "Authorization: Bearer $AEV_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "walletId":   "wal_8f2a...",
    "amountKzt":  10000,
    "anonymous":  false,
    "message":    "For the kids. Keep going."
  }'

# 201 Created
# {
#   "donationId":      "don_4f1a...",
#   "ledgerEntryId":   "vnx_b3c1...",
#   "transactionId":   "tx_a1b2...",
#   "campaignTotalKzt": 8420000,
#   "thankYouUrl":     "https://aevion.app/qgood/cmp_2f1a8b/thanks/don_4f1a..."
# }`}</Pre>

        <MetaCard
          tone="env"
          label="Env vars"
          items={[
            <><Code>QGOOD_ADMIN_EMAILS</Code> &mdash; comma-separated allowlist that can <Code>/approve</Code> pending campaigns.</>,
          ]}
        />

        <MetaCard
          tone="hook"
          label="Cross-product hooks"
          items={[
            <>
              <Code>POST /campaigns/:id/donations</Code> &mdash; debits the donor&apos;s
              QPayNet wallet, credits the campaign treasury wallet, appends a
              VeilNetX-Ledger <Code>donation</Code> entry, and emits Z-Tide{" "}
              <Code>qgood-donor</Code> (+4).
            </>,
            <>
              On campaign approval &mdash; emits Z-Tide{" "}
              <Code>qgood-organizer</Code> (+2) to the proposer.
            </>,
          ]}
        />

        {/* ─────────── OpenAPI ─────────── */}
        <SectionTitle id="openapi" color={ACCENT_PURPLE}>
          OpenAPI spec
        </SectionTitle>
        <P>
          The full machine-readable spec for all six modules is generated from the
          backend at build time and served at{" "}
          <Code>GET /api/openapi.json</Code>. The source of truth lives in:
        </P>
        <Pre>{`aevion-globus-backend/src/lib/openapiFintechSpec.ts`}</Pre>
        <P>
          Editing that file extends or amends the surface for any of the six
          modules. The frontend Stoplight UI at <Code>/developers/openapi</Code>{" "}
          consumes it directly &mdash; no separate sync step. Per-module specs
          (<Code>/api/qpaynet/openapi.json</Code> etc.) are scoped slices of the
          same spec, useful for partner integrations that only touch one module.
        </P>

        {/* ─────────── Smoke testing ─────────── */}
        <SectionTitle id="smoke" color={ACCENT_GREEN}>
          Smoke testing
        </SectionTitle>
        <P>
          Each fintech module ships a black-box smoke script that exercises its
          critical path against a running backend (local or production). Combined
          runner:
        </P>
        <Pre>{`# Local: start the backend first
cd aevion-globus-backend && npm run dev   # leaves http://localhost:4001 running

# Then in another shell, from the monorepo root:
npm run smoke:all

# Or run a single module
npm run smoke:qpaynet
npm run smoke:qmaskcard
npm run smoke:veilnetx-ledger
npm run smoke:ztide
npm run smoke:qchaingov
npm run smoke:qgood

# Production: override the base URL
SMOKE_BASE=https://api.aevion.app npm run smoke:all`}</Pre>

        <P>
          Individual scripts live in <Code>aevion-globus-backend/scripts/</Code>:
        </P>
        <ul
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: TEXT_PRIMARY,
            margin: "4px 0 0",
            paddingLeft: 20,
            fontFamily: MONO_FONT,
          }}
        >
          <li>scripts/qpaynet-smoke.js &mdash; 21 steps: wallet, deposit-stub, transfer, request, payout, webhook delivery, admin reconcile.</li>
          <li>scripts/qmaskcard-smoke.js &mdash; 7 steps: issue mask, authorize charge, revoke, fraud-score boundary.</li>
          <li>scripts/veilnetx-ledger-smoke.js &mdash; 5 steps: append entries, fetch head, verify chain integrity.</li>
          <li>scripts/ztide-smoke.js &mdash; 6 steps: service-key auth, ingest events, leaderboard pagination, rank promotion.</li>
          <li>scripts/qchaingov-smoke.js &mdash; 9 steps: propose, open, vote x3, close, verify tally + VeilNetX entry.</li>
          <li>scripts/qgood-smoke.js &mdash; 6 steps: propose, approve, donate, refund, verify ledger trail.</li>
        </ul>
        <P>
          Smoke failures exit non-zero and dump the failing step + response body.
          CI runs the suite on every push against a Postgres + Stripe-test
          backend; production smokes run post-deploy against{" "}
          <Code>api.aevion.app</Code>.
        </P>

        {/* ─────────── Footer ─────────── */}
        <hr
          style={{
            border: 0,
            borderTop: `1px solid ${CARD_BORDER}`,
            margin: "56px 0 24px",
          }}
        />
        <footer
          style={{
            fontSize: 13,
            color: TEXT_MUTED,
            lineHeight: 1.7,
          }}
        >
          <P>
            <strong>Base URL:</strong> <Code>https://api.aevion.app</Code>
            <br />
            <strong>SDK:</strong>{" "}
            <Code>npm i @dosymbek/qpaynet-client</Code> (typed wrapper for the
            QPayNet surface; QMaskCard / Z-Tide / QChainGov / QGood clients
            roadmapped Q3 2026).
            <br />
            <strong>Status &amp; uptime:</strong>{" "}
            <a
              href="/status"
              style={{ color: ACCENT_PURPLE, textDecoration: "none" }}
            >
              aevion.app/status
            </a>
            <br />
            <strong>Issues:</strong>{" "}
            <a
              href="https://github.com/Dossymbek281078/AEVION/issues"
              style={{ color: ACCENT_PURPLE, textDecoration: "none" }}
            >
              github.com/Dossymbek281078/AEVION/issues
            </a>
          </P>
        </footer>
      </div>
    </main>
  );
}
