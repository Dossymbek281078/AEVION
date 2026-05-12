import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type Entry = {
  id: string;
  sequenceNumber: number;
  module: string;
  kind: string;
  blindedFrom: string;
  blindedTo: string;
  amountCents: string | number;
  currency: string;
  meta?: Record<string, unknown> | null;
  prevHash: string;
  entryHash: string;
  createdAt: string;
};

type EntryResponse = {
  entry: Entry;
  integrity: "ok" | "broken";
  recomputedHash: string;
};

const MODULE_COLORS: Record<string, string> = {
  qpaynet: "#06b6d4",
  qgood: "#10b981",
  qmaskcard: "#a78bfa",
  bureau: "#f59e0b",
  qbuild: "#3b82f6",
  qsign: "#ec4899",
  qright: "#84cc16",
  aev: "#fbbf24",
  qcontract: "#14b8a6",
  qtrade: "#f97316",
  external: "#64748b",
};

const MODULE_DASHBOARDS: Record<string, { href: string; label: string }> = {
  qpaynet: { href: "/qpaynet", label: "View QPayNet dashboard" },
  qgood: { href: "/qgood/campaigns", label: "View QGood campaigns" },
  qmaskcard: { href: "/qmaskcard", label: "View QMaskCard" },
  bureau: { href: "/bureau", label: "View Bureau" },
  qbuild: { href: "/qbuild", label: "View QBuild" },
  qsign: { href: "/qsign", label: "View QSign" },
  qright: { href: "/qright", label: "View QRight" },
  aev: { href: "/aev", label: "View AEV tokenomics" },
  qcontract: { href: "/qcontract", label: "View QContract" },
  qtrade: { href: "/qtrade", label: "View QTrade" },
};

async function loadEntry(id: string): Promise<EntryResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/veilnetx-ledger/entries/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as EntryResponse;
  } catch {
    return null;
  }
}

function fmtAmount(cents: string | number, currency: string): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return `0 ${currency}`;
  const major = n / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(major)} ${currency}`;
  }
}

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    const y = Math.floor(d / 365);
    return `${y}y ago`;
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const short = id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  return {
    title: `Ledger entry ${short} · VeilNetX · AEVION`,
    description: `Cryptographic chain link, blinded participants, and inline integrity check for VeilNetX ledger entry ${short}.`,
    alternates: { canonical: `https://aevion.app/veilnetx/ledger/${id}` },
    robots: { index: false, follow: true },
    openGraph: {
      title: `Ledger entry ${short} · VeilNetX`,
      description: "Tamper-evident settlement chain entry with integrity verification.",
      type: "article",
    },
  };
}

export default async function VeilNetXLedgerEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadEntry(id);

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
        <section style={{ padding: "48px 24px 64px" }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <Link
              href="/veilnetx/ledger"
              style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}
            >
              ← Ledger explorer
            </Link>
            <div
              style={{
                marginTop: 28,
                padding: 36,
                background: "#1e293b",
                border: "1px dashed #334155",
                borderRadius: 14,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>·</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Entry not found</h1>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 18px" }}>
                The ledger entry <code style={{ color: "#a78bfa", wordBreak: "break-all" }}>{id}</code>{" "}
                does not exist or was never indexed. Try the explorer for recent activity.
              </p>
              <Link
                href="/veilnetx/ledger"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  background: "#a78bfa",
                  color: "#0f172a",
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Back to Ledger Explorer
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const { entry, integrity, recomputedHash } = data;
  const moduleColor = MODULE_COLORS[entry.module] || "#64748b";
  const dashboard = MODULE_DASHBOARDS[entry.module];
  const metaObj = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
  const metaIsEmpty = Object.keys(metaObj).length === 0;
  const curlCmd = `curl -s ${getApiBaseHint()}/api/veilnetx-ledger/chain/verify`;

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "32px 24px 64px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <Link
            href="/veilnetx/ledger"
            style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}
          >
            ← Ledger explorer
          </Link>

          {/* Integrity banner */}
          <div style={{ marginTop: 18 }}>
            {integrity === "ok" ? (
              <div
                style={{
                  padding: "12px 18px",
                  background: "rgba(52, 211, 153, 0.12)",
                  border: "1px solid rgba(52, 211, 153, 0.45)",
                  borderRadius: 12,
                  color: "#34d399",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 16 }}>✓</span>
                <span>Integrity verified · recomputed hash matches stored hash</span>
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 18px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: 13,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 16 }}>✗</span>
                  <span>
                    Integrity broken · this entry&apos;s stored hash diverges from recompute
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 10,
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      padding: 10,
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      Stored
                    </div>
                    <div style={{ color: "#ef4444", wordBreak: "break-all" }}>{entry.entryHash}</div>
                  </div>
                  <div
                    style={{
                      padding: 10,
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      Recomputed
                    </div>
                    <div style={{ color: "#a78bfa", wordBreak: "break-all" }}>{recomputedHash}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Entry summary card */}
          <Card style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: "1 1 auto", minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  Sequence
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: "#a78bfa",
                    fontFamily: "ui-monospace, Menlo, monospace",
                    lineHeight: 1,
                  }}
                >
                  #{entry.sequenceNumber}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginTop: 8,
                    fontFamily: "ui-monospace, Menlo, monospace",
                    wordBreak: "break-all",
                  }}
                >
                  id: {entry.id}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    padding: "5px 12px",
                    background: moduleColor + "22",
                    border: `1px solid ${moduleColor}66`,
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    color: moduleColor,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {entry.module}
                </span>
                <span style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 600 }}>
                  {entry.kind}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <MiniStat label="Amount" value={fmtAmount(entry.amountCents, entry.currency)} accent="#34d399" />
              <MiniStat label="Currency" value={entry.currency || "—"} />
              <MiniStat
                label="Created"
                value={new Date(entry.createdAt).toLocaleString()}
                sub={relativeTime(entry.createdAt)}
              />
            </div>
          </Card>

          {/* Chain link card */}
          <Card style={{ marginTop: 16 }}>
            <CardTitle>Chain position</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <HashRow label="Previous" value={entry.prevHash} />
              <HashRow label="This entry" value={entry.entryHash} highlight />
            </div>
            <p
              style={{
                marginTop: 16,
                fontSize: 12,
                color: "#94a3b8",
                lineHeight: 1.55,
              }}
            >
              This entry hashes the previous entry + its payload via SHA-256. Changing any earlier
              entry would invalidate every later hash. Select any hash to copy.
            </p>
          </Card>

          {/* Privacy participants card */}
          <Card style={{ marginTop: 16 }}>
            <CardTitle>Blinded participants</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <HashRow label="Blinded from" value={entry.blindedFrom} />
              <HashRow label="Blinded to" value={entry.blindedTo} />
            </div>
            <p
              style={{
                marginTop: 16,
                fontSize: 12,
                color: "#94a3b8",
                lineHeight: 1.55,
              }}
            >
              Participants are stored as HMAC-SHA-256 hashes salted with a server-side secret. Same
              identity → same blinded value (useful for analytics), but unreversible without the
              salt. AEVION never stores raw PII here.
            </p>
          </Card>

          {/* Meta JSON card */}
          <Card style={{ marginTop: 16 }}>
            <CardTitle>Metadata</CardTitle>
            {metaIsEmpty ? (
              <div
                style={{
                  padding: 18,
                  background: "#0f172a",
                  border: "1px dashed #334155",
                  borderRadius: 10,
                  color: "#64748b",
                  fontSize: 12,
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                No metadata attached
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 10,
                  color: "#e5e7eb",
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflow: "auto",
                  whiteSpace: "pre-wrap" as const,
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(metaObj, null, 2)}
              </pre>
            )}
          </Card>

          {/* Footer */}
          <div
            style={{
              marginTop: 28,
              padding: 18,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
                marginBottom: 8,
              }}
            >
              Verify the full chain
            </div>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#a78bfa",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {curlCmd}
            </code>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              Select the command above to copy. Returns <code style={{ color: "#a78bfa" }}>{`{ ok: true, length, head }`}</code>{" "}
              if every link in the chain validates.
            </p>

            {dashboard && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #334155" }}>
                <Link
                  href={dashboard.href}
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    background: moduleColor + "22",
                    border: `1px solid ${moduleColor}55`,
                    borderRadius: 8,
                    color: moduleColor,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {dashboard.label} →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function getApiBaseHint(): string {
  // Show a clean public-facing hint in curl examples; fall back to relative.
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (pub && /^https?:\/\//i.test(pub)) return pub.replace(/\/+$/, "");
  return "https://aevion.app";
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 20,
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 14px",
        fontSize: 13,
        fontWeight: 800,
        color: "#94a3b8",
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </h2>
  );
}

function MiniStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: accent || "#f1f5f9",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function HashRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "10px 12px",
          background: "#0f172a",
          border: `1px solid ${highlight ? "#a78bfa55" : "#334155"}`,
          borderRadius: 8,
          color: highlight ? "#a78bfa" : "#e5e7eb",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.5,
          wordBreak: "break-all",
          userSelect: "all" as const,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}
