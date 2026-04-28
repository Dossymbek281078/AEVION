"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Currency = "USD" | "EUR" | "KZT" | "AEC";
type SettlementTarget = "bank" | "aec";

type PaymentLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  description: string;
  settlement: SettlementTarget;
  createdAt: number;
  expiresAt: number | null;
  status: "active" | "paid" | "expired";
};

const STORAGE_KEY = "aevion.payments.links.v1";

const currencyMeta: Record<Currency, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  KZT: { symbol: "₸", label: "Kazakhstani Tenge" },
  AEC: { symbol: "AEC", label: "AEVION Credit" },
};

function formatAmount(amount: number, currency: Currency) {
  const meta = currencyMeta[currency];
  if (currency === "AEC") return `${amount.toLocaleString()} ${meta.symbol}`;
  if (currency === "KZT")
    return `${amount.toLocaleString("ru-RU")} ${meta.symbol}`;
  return `${meta.symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function genId() {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36).slice(-4);
  return `pl_${stamp}${rand}`;
}

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  fontSize: 14,
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const chipBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  color: "#0f172a",
  transition: "all 0.12s",
};

function chipActive(color: string): CSSProperties {
  return {
    ...chipBase,
    background: color,
    color: "#fff",
    borderColor: color,
    boxShadow: `0 4px 12px ${color}44`,
  };
}

export default function PaymentLinksPage() {
  const [amount, setAmount] = useState<string>("99.00");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [title, setTitle] = useState<string>("AEVION Pro · Monthly");
  const [description, setDescription] = useState<string>(
    "Access to AEVION Pro tier for one month — includes QSign, QRight, and Bureau v2."
  );
  const [settlement, setSettlement] = useState<SettlementTarget>("bank");
  const [expiresInDays, setExpiresInDays] = useState<number>(7);

  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PaymentLink[] = JSON.parse(raw);
        const now = Date.now();
        const updated = parsed.map((l) =>
          l.status === "active" && l.expiresAt && l.expiresAt < now
            ? { ...l, status: "expired" as const }
            : l
        );
        setLinks(updated);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    } catch {
      // ignore
    }
  }, [links]);

  const stats = useMemo(() => {
    const active = links.filter((l) => l.status === "active").length;
    const paid = links.filter((l) => l.status === "paid").length;
    const expired = links.filter((l) => l.status === "expired").length;
    const totalActive = links
      .filter((l) => l.status === "active")
      .reduce((acc, l) => acc + l.amount, 0);
    return { active, paid, expired, totalActive };
  }, [links]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) return;
    if (!title.trim()) return;
    const now = Date.now();
    const expiresAt =
      expiresInDays > 0 ? now + expiresInDays * 24 * 60 * 60 * 1000 : null;
    const link: PaymentLink = {
      id: genId(),
      amount: num,
      currency,
      title: title.trim(),
      description: description.trim(),
      settlement,
      createdAt: now,
      expiresAt,
      status: "active",
    };
    setLinks((prev) => [link, ...prev]);
  }

  function copyLink(id: string) {
    if (typeof window === "undefined") return;
    const url = `${origin}/pay/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    });
  }

  function markPaid(id: string) {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: "paid" } : l))
    );
  }

  function expire(id: string) {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: "expired" } : l))
    );
  }

  function remove(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #134e4a 48%, #0d9488 100%)",
          color: "#fff",
          padding: "32px 24px 38px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/payments"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <h1
            style={{
              fontSize: "clamp(22px, 3.6vw, 34px)",
              fontWeight: 800,
              margin: "10px 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            Payment Links
          </h1>
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 16px)",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Generate a shareable link in seconds. Send it via email, chat, or
            QR — payer completes checkout without any integration on your side.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <StatCard
              label="Active links"
              value={stats.active.toString()}
              accent="#5eead4"
            />
            <StatCard
              label="Paid"
              value={stats.paid.toString()}
              accent="#86efac"
            />
            <StatCard
              label="Expired"
              value={stats.expired.toString()}
              accent="#fda4af"
            />
            <StatCard
              label="Open volume"
              value={`$${stats.totalActive.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              accent="#fcd34d"
            />
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={handleCreate}
          style={{
            padding: 22,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
            display: "grid",
            gap: 14,
            position: "sticky",
            top: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#0d9488",
            }}
          >
            New payment link
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is the payer paying for?"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                style={inputStyle}
              >
                {(Object.keys(currencyMeta) as Currency[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Settle to</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSettlement("bank")}
                style={
                  settlement === "bank"
                    ? chipActive("#0d9488")
                    : chipBase
                }
              >
                🏦 AEVION Bank
              </button>
              <button
                type="button"
                onClick={() => setSettlement("aec")}
                style={
                  settlement === "aec"
                    ? chipActive("#7c3aed")
                    : chipBase
                }
              >
                💎 AEC Wallet
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Expires in</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 7, 30, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiresInDays(d)}
                  style={
                    expiresInDays === d ? chipActive("#0f172a") : chipBase
                  }
                >
                  {d === 0 ? "Never" : `${d}d`}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "13px 20px",
              borderRadius: 12,
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
            }}
          >
            Create link →
          </button>
        </form>

        <section
          style={{
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#7c3aed",
                }}
              >
                Recent links
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  margin: "4px 0 0",
                  letterSpacing: "-0.02em",
                  color: "#0f172a",
                }}
              >
                {links.length === 0
                  ? "No links yet"
                  : `${links.length} payment link${links.length === 1 ? "" : "s"}`}
              </h2>
            </div>
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete all payment links?")) setLinks([]);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: 12,
                  border: "1px solid rgba(220,38,38,0.3)",
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {links.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                borderRadius: 16,
                border: "1px dashed rgba(15,23,42,0.2)",
                textAlign: "center",
                color: "#64748b",
                fontSize: 14,
                background: "rgba(15,23,42,0.02)",
              }}
            >
              Create your first payment link using the form on the left. Links
              are stored locally in this browser for the demo.
            </div>
          ) : (
            links.map((l) => (
              <article
                key={l.id}
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "#fff",
                  boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                  display: "grid",
                  gap: 12,
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                        color: "#0f172a",
                        marginBottom: 2,
                      }}
                    >
                      {l.title}
                    </div>
                    {l.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          lineHeight: 1.5,
                        }}
                      >
                        {l.description}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 20,
                      color: "#0d9488",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatAmount(l.amount, l.currency)}
                  </div>
                </header>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <Badge status={l.status} />
                  <SmallTag>
                    {l.settlement === "bank" ? "🏦 Bank" : "💎 AEC Wallet"}
                  </SmallTag>
                  <SmallTag>
                    {l.expiresAt
                      ? `Expires ${new Date(l.expiresAt).toLocaleDateString()}`
                      : "No expiry"}
                  </SmallTag>
                  <SmallTag>
                    Created {new Date(l.createdAt).toLocaleDateString()}
                  </SmallTag>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(15,23,42,0.04)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    color: "#0f172a",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {origin || "https://aevion.app"}/pay/{l.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(l.id)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: copiedId === l.id ? "#059669" : "#0f172a",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedId === l.id ? "Copied ✓" : "Copy"}
                  </button>
                </div>

                {l.status === "active" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => markPaid(l.id)}
                      style={miniBtn("#059669")}
                    >
                      Mark as paid
                    </button>
                    <button
                      type="button"
                      onClick={() => expire(l.id)}
                      style={miniBtn("#475569")}
                    >
                      Expire
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      style={miniBtn("#dc2626", true)}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {l.status !== "active" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      style={miniBtn("#dc2626", true)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function miniBtn(color: string, ghost = false): CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 8,
    background: ghost ? "transparent" : color,
    color: ghost ? color : "#fff",
    fontWeight: 700,
    fontSize: 12,
    border: ghost ? `1px solid ${color}55` : "none",
    cursor: "pointer",
  };
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

function Badge({ status }: { status: PaymentLink["status"] }) {
  const map: Record<
    PaymentLink["status"],
    { bg: string; fg: string; label: string }
  > = {
    active: { bg: "rgba(13,148,136,0.12)", fg: "#0f766e", label: "Active" },
    paid: { bg: "rgba(5,150,105,0.12)", fg: "#047857", label: "Paid" },
    expired: { bg: "rgba(100,116,139,0.12)", fg: "#475569", label: "Expired" },
  };
  const m = map[status];
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 6,
        background: m.bg,
        color: m.fg,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {m.label}
    </span>
  );
}

function SmallTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 6,
        background: "rgba(15,23,42,0.05)",
        color: "#475569",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
