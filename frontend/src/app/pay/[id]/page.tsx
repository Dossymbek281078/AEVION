"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState, type CSSProperties } from "react";

type Currency = "USD" | "EUR" | "KZT" | "AEC";

type PaymentLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  description: string;
  settlement: "bank" | "aec";
  createdAt: number;
  expiresAt: number | null;
  status: "active" | "paid" | "expired";
};

type PaymentMethod = {
  id: string;
  name: string;
  icon: string;
  category: "card" | "wallet" | "bank" | "crypto" | "aevion";
  defaultEnabled: boolean;
};

const LINKS_KEY = "aevion.payments.links.v1";
const METHODS_KEY = "aevion.payments.methods.v1";

const FALLBACK_METHODS: PaymentMethod[] = [
  { id: "visa-mc", name: "Visa & Mastercard", icon: "💳", category: "card", defaultEnabled: true },
  { id: "amex", name: "American Express", icon: "💳", category: "card", defaultEnabled: true },
  { id: "apple-pay", name: "Apple Pay", icon: "🍎", category: "wallet", defaultEnabled: true },
  { id: "google-pay", name: "Google Pay", icon: "🟢", category: "wallet", defaultEnabled: true },
  { id: "kaspi", name: "Kaspi Pay", icon: "🇰🇿", category: "wallet", defaultEnabled: false },
  { id: "btc", name: "Bitcoin (Lightning)", icon: "⚡", category: "crypto", defaultEnabled: false },
  { id: "usdc", name: "USDC", icon: "🪙", category: "crypto", defaultEnabled: false },
  { id: "aec-credit", name: "AEC Credits", icon: "💎", category: "aevion", defaultEnabled: true },
  { id: "aevion-bank", name: "AEVION Bank Transfer", icon: "🏛️", category: "aevion", defaultEnabled: true },
];

function formatAmount(amount: number, currency: Currency) {
  if (currency === "AEC") return `${amount.toLocaleString()} AEC`;
  if (currency === "KZT") return `${amount.toLocaleString("ru-RU")} ₸`;
  if (currency === "EUR")
    return `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Phase =
  | "loading"
  | "not-found"
  | "expired"
  | "already-paid"
  | "selecting"
  | "authorizing"
  | "capturing"
  | "settled"
  | "failed";

export default function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [phase, setPhase] = useState<Phase>("loading");
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyMethods() {
      const rawMethods = window.localStorage.getItem(METHODS_KEY);
      const methodsState: Record<string, boolean> = {};
      if (rawMethods) {
        Object.assign(methodsState, JSON.parse(rawMethods));
      } else {
        for (const m of FALLBACK_METHODS) methodsState[m.id] = m.defaultEnabled;
      }
      setMethods(FALLBACK_METHODS);
      setEnabled(methodsState);
      const firstEnabled = FALLBACK_METHODS.find((m) => methodsState[m.id]);
      setPicked(firstEnabled?.id ?? null);
    }

    function classify(found: PaymentLink) {
      setLink(found);
      if (found.status === "paid") {
        setPhase("already-paid");
        return;
      }
      if (
        found.status === "expired" ||
        (found.expiresAt && found.expiresAt < Date.now())
      ) {
        setPhase("expired");
        return;
      }
      applyMethods();
      setPhase("selecting");
    }

    try {
      const rawLinks = window.localStorage.getItem(LINKS_KEY);
      const list: PaymentLink[] = rawLinks ? JSON.parse(rawLinks) : [];
      const found = list.find((l) => l.id === id);
      if (found) {
        classify(found);
        return;
      }
    } catch {
      // fall through to API
    }

    fetch(`${window.location.origin}/api/pay/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const remote = (await r.json()) as {
          id: string;
          amount: number;
          currency: Currency;
          title: string;
          description: string;
          settlement: "bank" | "aec";
          status: "active" | "paid" | "expired";
          paid_at: number | null;
        };
        classify({
          id: remote.id,
          amount: remote.amount,
          currency: remote.currency,
          title: remote.title,
          description: remote.description,
          settlement: remote.settlement,
          createdAt: Date.now(),
          expiresAt: null,
          status: remote.status,
        });
      })
      .catch(() => setPhase("not-found"));
  }, [id]);

  const visibleMethods = useMemo(
    () => methods.filter((m) => enabled[m.id]),
    [methods, enabled]
  );

  const pickedMeta = useMemo(
    () => methods.find((m) => m.id === picked) ?? null,
    [methods, picked]
  );

  function markPaid(method: string) {
    if (typeof window === "undefined" || !link) return;
    try {
      const raw = window.localStorage.getItem(LINKS_KEY);
      const list: PaymentLink[] = raw ? JSON.parse(raw) : [];
      const updated = list.map((l) =>
        l.id === link.id ? { ...l, status: "paid" as const } : l
      );
      window.localStorage.setItem(LINKS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    const digits = card.number.replace(/\D/g, "");
    const last4 = digits.length >= 4 ? digits.slice(-4) : undefined;
    void fetch(`${window.location.origin}/api/pay/${link.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, last4 }),
    }).catch(() => undefined);
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !pickedMeta) return;
    setError(null);

    if (pickedMeta.category === "card") {
      const digits = card.number.replace(/\s/g, "");
      if (digits.length < 13) {
        setError("Card number looks too short.");
        return;
      }
      if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(card.exp)) {
        setError("Expiration must look like 12/28.");
        return;
      }
      if (card.cvc.length < 3) {
        setError("CVC must be at least 3 digits.");
        return;
      }
    }

    setPhase("authorizing");
    window.setTimeout(() => setPhase("capturing"), 800);
    window.setTimeout(() => {
      const declined = pickedMeta.category === "card" && card.number.includes("0000 0000");
      if (declined) {
        setPhase("failed");
        setError("Card declined: insufficient funds.");
      } else {
        markPaid(pickedMeta.id);
        setPhase("settled");
      }
    }, 1700);
  }

  if (phase === "loading") {
    return (
      <Shell>
        <Card>
          <div style={{ color: "#64748b", fontSize: 14 }}>Loading checkout…</div>
        </Card>
      </Shell>
    );
  }

  if (phase === "not-found") {
    return (
      <Shell>
        <Card>
          <Title>Link not found</Title>
          <p style={subtitleStyle}>
            We couldn&apos;t find a payment link with id <code>{id}</code> on
            this device. Demo links are stored locally in the merchant&apos;s
            browser — open the original device or ask the merchant for a fresh
            one.
          </p>
          <Link href="/payments" style={primaryBtn}>
            Back to Payments Rail
          </Link>
        </Card>
      </Shell>
    );
  }

  if (phase === "expired" && link) {
    return (
      <Shell>
        <Card>
          <Title>This link has expired</Title>
          <p style={subtitleStyle}>
            Payment link for <strong>{link.title}</strong> is no longer
            accepting payments. Ask the merchant for a new one.
          </p>
          <Link href="/payments" style={primaryBtn}>
            Back to Payments Rail
          </Link>
        </Card>
      </Shell>
    );
  }

  if (phase === "already-paid" && link) {
    return (
      <Shell>
        <Card>
          <Title accent="#059669">Already paid · ✓</Title>
          <p style={subtitleStyle}>
            <strong>{link.title}</strong> has been paid. You don&apos;t need to
            pay again.
          </p>
          <div style={amountBoxStyle}>
            {formatAmount(link.amount, link.currency)}
          </div>
          <Link href="/payments" style={primaryBtn}>
            Back to Payments Rail
          </Link>
        </Card>
      </Shell>
    );
  }

  if (phase === "settled" && link) {
    return (
      <Shell>
        <Card>
          <div
            style={{
              fontSize: 48,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            ✅
          </div>
          <Title accent="#059669">Payment captured</Title>
          <p style={subtitleStyle}>
            <strong>{link.title}</strong> · paid via {pickedMeta?.name}.
            Webhook <code>checkout.completed</code> dispatched to the
            merchant. Settlement scheduled to{" "}
            {link.settlement === "bank" ? "AEVION Bank" : "AEC Wallet"}.
          </p>
          <div style={amountBoxStyle}>
            {formatAmount(link.amount, link.currency)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/r/${id}`} style={primaryBtn}>
              View receipt
            </Link>
            <Link
              href={`/pay/${id}`}
              style={{
                ...primaryBtn,
                background: "#fff",
                color: "#0f172a",
                border: "1px solid rgba(15,23,42,0.18)",
              }}
            >
              Done
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === "failed" && link) {
    return (
      <Shell>
        <Card>
          <Title accent="#dc2626">Payment failed</Title>
          <p style={subtitleStyle}>
            {error ?? "Unable to process this payment. Please try a different method."}
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase("selecting");
              setError(null);
            }}
            style={primaryBtn}
          >
            Try again
          </button>
        </Card>
      </Shell>
    );
  }

  if (!link) return null;

  const processing = phase === "authorizing" || phase === "capturing";

  return (
    <Shell>
      <Card>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#0d9488",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          AEVION · Secure checkout
        </div>
        <Title>{link.title}</Title>
        {link.description && (
          <p style={subtitleStyle}>{link.description}</p>
        )}
        <div style={amountBoxStyle}>
          {formatAmount(link.amount, link.currency)}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          Payment method
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {visibleMethods.map((m) => {
            const active = picked === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => !processing && setPicked(m.id)}
                disabled={processing}
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: active
                    ? "2px solid #0d9488"
                    : "1px solid rgba(15,23,42,0.15)",
                  background: active ? "rgba(13,148,136,0.05)" : "#fff",
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: processing ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: "center",
                  opacity: processing ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handlePay} style={{ display: "grid", gap: 12 }}>
          {pickedMeta?.category === "card" && (
            <>
              <div>
                <label style={labelStyle}>Card number</label>
                <input
                  type="text"
                  value={card.number}
                  onChange={(e) =>
                    setCard((c) => ({
                      ...c,
                      number: e.target.value
                        .replace(/[^\d]/g, "")
                        .slice(0, 19)
                        .replace(/(\d{4})(?=\d)/g, "$1 "),
                    }))
                  }
                  placeholder="4242 4242 4242 4242"
                  style={inputStyle}
                  disabled={processing}
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Expiry</label>
                  <input
                    type="text"
                    value={card.exp}
                    onChange={(e) => setCard((c) => ({ ...c, exp: e.target.value }))}
                    placeholder="12/28"
                    style={inputStyle}
                    disabled={processing}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>CVC</label>
                  <input
                    type="text"
                    value={card.cvc}
                    onChange={(e) =>
                      setCard((c) => ({
                        ...c,
                        cvc: e.target.value.replace(/[^\d]/g, "").slice(0, 4),
                      }))
                    }
                    placeholder="123"
                    style={inputStyle}
                    disabled={processing}
                    required
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  marginTop: -4,
                }}
              >
                Demo: any 16-digit number works. Use{" "}
                <code>4000 0000 0000 0000</code> to simulate a decline.
              </div>
            </>
          )}

          {pickedMeta?.category === "wallet" && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.08)",
                fontSize: 13,
                color: "#475569",
              }}
            >
              You&apos;ll be prompted to authorize this payment with{" "}
              <strong>{pickedMeta.name}</strong> on the next step.
            </div>
          )}

          {pickedMeta?.category === "crypto" && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                fontSize: 13,
                color: "#92400e",
              }}
            >
              Scan the {pickedMeta.name} invoice with any wallet. Network fee
              is included in the total.
            </div>
          )}

          {pickedMeta?.category === "aevion" && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(13,148,136,0.06)",
                border: "1px solid rgba(13,148,136,0.2)",
                fontSize: 13,
                color: "#0f766e",
              }}
            >
              Authorize with your AEVION ID — zero fees, instant settlement.
            </div>
          )}

          {pickedMeta?.category === "bank" && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(124,58,237,0.06)",
                border: "1px solid rgba(124,58,237,0.2)",
                fontSize: 13,
                color: "#6d28d9",
              }}
            >
              Bank transfer takes 1–5 business days to clear. The merchant will
              be notified once funds arrive.
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={processing || !picked}
            style={{
              ...primaryBtn,
              opacity: processing ? 0.7 : 1,
              cursor: processing ? "not-allowed" : "pointer",
            }}
          >
            {phase === "authorizing"
              ? "Authorizing…"
              : phase === "capturing"
              ? "Capturing funds…"
              : `Pay ${formatAmount(link.amount, link.currency)} →`}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(15,23,42,0.06)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#94a3b8",
          }}
        >
          <span>Powered by AEVION Payments Rail</span>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {link.id}
          </span>
        </div>
      </Card>
    </Shell>
  );
}

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

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const primaryBtn: CSSProperties = {
  display: "inline-block",
  padding: "13px 20px",
  borderRadius: 12,
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  textAlign: "center",
  textDecoration: "none",
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.55,
  margin: "0 0 14px",
};

const amountBoxStyle: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 14,
  background: "rgba(13,148,136,0.06)",
  border: "1px solid rgba(13,148,136,0.18)",
  textAlign: "center",
  fontSize: 28,
  fontWeight: 900,
  color: "#0f766e",
  letterSpacing: "-0.02em",
  marginBottom: 18,
};

function Title({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <h1
      style={{
        fontSize: 22,
        fontWeight: 900,
        margin: "0 0 6px",
        letterSpacing: "-0.02em",
        color: accent ?? "#0f172a",
      }}
    >
      {children}
    </h1>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 480,
        width: "100%",
        background: "#fff",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 16px 60px rgba(15,23,42,0.18)",
        border: "1px solid rgba(15,23,42,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(145deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)",
        padding: "48px 18px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      {children}
    </main>
  );
}
