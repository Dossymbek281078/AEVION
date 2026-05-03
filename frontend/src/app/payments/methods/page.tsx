"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type MethodCategory = "card" | "wallet" | "bank" | "crypto" | "aevion";

type PaymentMethod = {
  id: string;
  name: string;
  category: MethodCategory;
  icon: string;
  region: string;
  fee: string;
  settlementTime: string;
  description: string;
  defaultEnabled: boolean;
};

const METHODS: PaymentMethod[] = [
  {
    id: "visa-mc",
    name: "Visa & Mastercard",
    category: "card",
    icon: "💳",
    region: "Global",
    fee: "2.9% + $0.30",
    settlementTime: "T+2",
    description:
      "Accept any Visa or Mastercard worldwide. 3-D Secure 2 enforced by default for fraud protection.",
    defaultEnabled: true,
  },
  {
    id: "amex",
    name: "American Express",
    category: "card",
    icon: "💳",
    region: "Global",
    fee: "3.4% + $0.30",
    settlementTime: "T+2",
    description:
      "Premium card acceptance with chargeback dispute handling baked into the rail.",
    defaultEnabled: true,
  },
  {
    id: "apple-pay",
    name: "Apple Pay",
    category: "wallet",
    icon: "🍎",
    region: "Global",
    fee: "2.9% + $0.30",
    settlementTime: "T+2",
    description:
      "Tokenized one-tap checkout on Safari/iOS. Biometric confirmation reduces fraud rate ~70%.",
    defaultEnabled: true,
  },
  {
    id: "google-pay",
    name: "Google Pay",
    category: "wallet",
    icon: "🟢",
    region: "Global",
    fee: "2.9% + $0.30",
    settlementTime: "T+2",
    description:
      "Tokenized checkout across Chrome/Android. Auto-fills shipping & contact data when granted.",
    defaultEnabled: true,
  },
  {
    id: "kaspi",
    name: "Kaspi Pay",
    category: "wallet",
    icon: "🇰🇿",
    region: "Kazakhstan",
    fee: "1.95%",
    settlementTime: "T+1",
    description:
      "Local KZT wallet with QR-code checkout. Largest Kazakh fintech footprint — required for KZ residency.",
    defaultEnabled: false,
  },
  {
    id: "sepa",
    name: "SEPA Direct Debit",
    category: "bank",
    icon: "🏦",
    region: "EU",
    fee: "0.8% (cap €5)",
    settlementTime: "T+5",
    description:
      "Pull payments directly from EU bank accounts. Best for recurring billing with low fees.",
    defaultEnabled: false,
  },
  {
    id: "ach",
    name: "ACH Transfer",
    category: "bank",
    icon: "🇺🇸",
    region: "USA",
    fee: "0.8% (cap $5)",
    settlementTime: "T+3",
    description:
      "US automated clearing house transfers. Suitable for B2B invoices over $1k.",
    defaultEnabled: false,
  },
  {
    id: "wire",
    name: "Wire Transfer",
    category: "bank",
    icon: "🌍",
    region: "Global",
    fee: "$15 flat",
    settlementTime: "T+1",
    description:
      "Same-day SWIFT wires for high-value invoices. Manually reconciled with reference codes.",
    defaultEnabled: false,
  },
  {
    id: "btc",
    name: "Bitcoin (Lightning)",
    category: "crypto",
    icon: "⚡",
    region: "Global",
    fee: "0.5%",
    settlementTime: "T+0",
    description:
      "Instant Lightning Network settlement. Auto-converts to fiat or AEC at quote time.",
    defaultEnabled: false,
  },
  {
    id: "usdc",
    name: "USDC (Stablecoin)",
    category: "crypto",
    icon: "🪙",
    region: "Global",
    fee: "0.5%",
    settlementTime: "T+0",
    description:
      "Settle in USDC across Ethereum, Base, or Solana. Treasury can hold as USD-pegged reserve.",
    defaultEnabled: false,
  },
  {
    id: "aec-credit",
    name: "AEC Credits",
    category: "aevion",
    icon: "💎",
    region: "AEVION",
    fee: "0.0%",
    settlementTime: "Instant",
    description:
      "Native AEVION credit settlement — zero fees, instant clearing across the trust graph. Auto-splits royalties.",
    defaultEnabled: true,
  },
  {
    id: "aevion-bank",
    name: "AEVION Bank Transfer",
    category: "aevion",
    icon: "🏛️",
    region: "AEVION",
    fee: "0.0%",
    settlementTime: "Instant",
    description:
      "Bank-to-bank inside the AEVION network. Includes royalty auto-split via the Bank module.",
    defaultEnabled: true,
  },
];

const CATEGORIES: { id: MethodCategory; label: string; color: string }[] = [
  { id: "card", label: "Cards", color: "#0d9488" },
  { id: "wallet", label: "Wallets", color: "#2563eb" },
  { id: "bank", label: "Bank", color: "#7c3aed" },
  { id: "crypto", label: "Crypto", color: "#f59e0b" },
  { id: "aevion", label: "AEVION", color: "#0f766e" },
];

const STORAGE_KEY = "aevion.payments.methods.v1";

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

function categoryColor(cat: MethodCategory) {
  return CATEGORIES.find((c) => c.id === cat)?.color ?? "#64748b";
}

function categoryLabel(cat: MethodCategory) {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

export default function PaymentMethodsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<MethodCategory | "all">("all");
  const [demoMethod, setDemoMethod] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState<
    "idle" | "auth" | "processing" | "success"
  >("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setEnabled(JSON.parse(raw));
        return;
      }
    } catch {
      // ignore
    }
    const initial: Record<string, boolean> = {};
    for (const m of METHODS) initial[m.id] = m.defaultEnabled;
    setEnabled(initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(enabled).length === 0) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }, [enabled]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? METHODS
        : METHODS.filter((m) => m.category === filter),
    [filter]
  );

  const stats = useMemo(() => {
    const total = METHODS.length;
    const on = Object.values(enabled).filter(Boolean).length;
    const regions = new Set(METHODS.map((m) => m.region)).size;
    const aevionOn = METHODS.filter(
      (m) => m.category === "aevion" && enabled[m.id]
    ).length;
    return { total, on, regions, aevionOn };
  }, [enabled]);

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function startDemo(id: string) {
    setDemoMethod(id);
    setDemoStep("auth");
    window.setTimeout(() => setDemoStep("processing"), 900);
    window.setTimeout(() => setDemoStep("success"), 2100);
  }

  function closeDemo() {
    setDemoMethod(null);
    setDemoStep("idle");
  }

  const demoData = demoMethod
    ? METHODS.find((m) => m.id === demoMethod)
    : null;

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #1e3a8a 48%, #2563eb 100%)",
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
            Payment Methods
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
            One unified API surface across every rail — cards, wallets, banks,
            crypto, and native AEVION transfers. Toggle availability per
            method to control the checkout experience.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <Stat label="Methods enabled" value={`${stats.on}/${stats.total}`} accent="#5eead4" />
            <Stat label="Regions covered" value={stats.regions.toString()} accent="#fcd34d" />
            <Stat label="AEVION rails on" value={stats.aevionOn.toString()} accent="#86efac" />
            <Stat label="Single API" value="v1" accent="#c4b5fd" />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => setFilter("all")}
            style={filter === "all" ? chipActive("#0f172a") : chipBase}
          >
            All ({METHODS.length})
          </button>
          {CATEGORIES.map((c) => {
            const count = METHODS.filter((m) => m.category === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                style={filter === c.id ? chipActive(c.color) : chipBase}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {visible.map((m) => {
            const isOn = !!enabled[m.id];
            const color = categoryColor(m.category);
            return (
              <article
                key={m.id}
                style={{
                  padding: 18,
                  borderRadius: 16,
                  border: `1px solid ${isOn ? color + "44" : "rgba(15,23,42,0.1)"}`,
                  background: "#fff",
                  boxShadow: isOn
                    ? `0 4px 16px ${color}22`
                    : "0 2px 10px rgba(15,23,42,0.04)",
                  display: "grid",
                  gap: 10,
                  opacity: isOn ? 1 : 0.78,
                  transition: "all 0.15s",
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    <div style={{ fontSize: 28 }}>{m.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 16,
                          color: "#0f172a",
                          marginBottom: 2,
                        }}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {categoryLabel(m.category)} · {m.region}
                      </div>
                    </div>
                  </div>

                  <ToggleSwitch on={isOn} color={color} onClick={() => toggle(m.id)} />
                </header>

                <p
                  style={{
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {m.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 11,
                  }}
                >
                  <Tag>Fee: {m.fee}</Tag>
                  <Tag>Settles {m.settlementTime}</Tag>
                </div>

                <button
                  type="button"
                  onClick={() => startDemo(m.id)}
                  disabled={!isOn}
                  style={{
                    marginTop: 4,
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: isOn ? color : "rgba(15,23,42,0.08)",
                    color: isOn ? "#fff" : "#94a3b8",
                    fontWeight: 700,
                    fontSize: 12,
                    border: "none",
                    cursor: isOn ? "pointer" : "not-allowed",
                  }}
                >
                  {isOn ? "Try checkout demo →" : "Enable to test"}
                </button>
              </article>
            );
          })}
        </div>

        <section
          style={{
            marginTop: 32,
            padding: "24px",
            borderRadius: 18,
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#5eead4",
              marginBottom: 6,
            }}
          >
            Single API surface
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 14px" }}>
            One call, every method
          </h2>
          <pre
            style={{
              margin: 0,
              padding: "16px 18px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "#e2e8f0",
              overflow: "auto",
              lineHeight: 1.65,
            }}
          >
{`POST /payments/v1/checkout
{
  "amount": 9900,
  "currency": "USD",
  "settlement": "aevion-bank",
  "methods": ["visa-mc", "apple-pay", "aec-credit"],
  "metadata": { "order_id": "ORD-1042" }
}`}
          </pre>
          <p
            style={{
              fontSize: 13,
              color: "#94a3b8",
              marginTop: 12,
              marginBottom: 0,
              lineHeight: 1.55,
            }}
          >
            The rail handles method-specific quirks, 3-D Secure, tokenization,
            and routing internally. You get one webhook event regardless of
            which method the payer chose.
          </p>
        </section>
      </div>

      {demoMethod && demoData && (
        <div
          onClick={closeDemo}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 420,
              width: "100%",
              background: "#fff",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 20px 60px rgba(15,23,42,0.4)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 32 }}>{demoData.icon}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: "#0f172a" }}>
                  {demoData.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 700,
                  }}
                >
                  Mock checkout · $99.00 USD
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <DemoStep
                label="Authorize"
                active={demoStep === "auth"}
                done={demoStep === "processing" || demoStep === "success"}
              />
              <DemoStep
                label="Process"
                active={demoStep === "processing"}
                done={demoStep === "success"}
              />
              <DemoStep
                label="Settle"
                active={demoStep === "success"}
                done={demoStep === "success"}
                last
              />
            </div>

            {demoStep === "success" && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  fontSize: 13,
                  color: "#047857",
                  fontWeight: 700,
                }}
              >
                ✓ Payment captured. Webhook <code>checkout.completed</code>{" "}
                fired.
              </div>
            )}

            <button
              type="button"
              onClick={closeDemo}
              style={{
                padding: "11px 18px",
                borderRadius: 10,
                background: demoStep === "success" ? "#0d9488" : "#0f172a",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              {demoStep === "success" ? "Done" : "Close"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ToggleSwitch({
  on,
  color,
  onClick,
}: {
  on: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        background: on ? color : "rgba(15,23,42,0.18)",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
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

function Stat({
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

function DemoStep({
  label,
  active,
  done,
  last,
}: {
  label: string;
  active: boolean;
  done: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        borderBottom: last ? "none" : "1px solid rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? "#059669" : active ? "#0d9488" : "rgba(15,23,42,0.1)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {done ? "✓" : active ? "•" : ""}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: done || active ? "#0f172a" : "#94a3b8",
        }}
      >
        {label}
        {active && !done && (
          <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
            …
          </span>
        )}
      </div>
    </div>
  );
}
