import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { store } from "../../api/payments/v1/_lib";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  "visa-mc": "Visa / Mastercard",
  amex: "American Express",
  apple: "Apple Pay",
  google: "Google Pay",
  kaspi: "Kaspi (KZ)",
  sepa: "SEPA Direct",
  ach: "ACH (US)",
  wire: "Wire transfer",
  btc: "Bitcoin (Lightning)",
  usdc: "USDC",
  aec: "AEC Credits",
  aevion_bank: "AEVION Bank",
  card: "Card",
};

function formatAmount(amount: number, currency: string) {
  if (currency === "AEC") return `${amount.toLocaleString()} AEC`;
  if (currency === "KZT") return `${amount.toLocaleString("ru-RU")} ₸`;
  if (currency === "EUR")
    return `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const link = store.links.get(id);
  const title = link
    ? `Receipt · ${link.title} · ${formatAmount(link.amount, link.currency)}`
    : `Receipt · ${id}`;
  return {
    title,
    description: "AEVION Payments — printable receipt.",
    robots: { index: false, follow: false },
  };
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const link = store.links.get(id);
  if (!link) notFound();
  if (link.status !== "paid") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "60px 20px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#0f172a",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 540,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: 36,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Receipt unavailable
          </h1>
          <p style={{ color: "#64748b", lineHeight: 1.55 }}>
            This payment link is currently <strong>{link.status}</strong>. A
            receipt is generated only after the link has been captured. Once
            paid, return to <code>/r/{id}</code>.
          </p>
          <Link
            href={`/pay/${id}`}
            style={{
              display: "inline-block",
              marginTop: 18,
              padding: "11px 18px",
              background: "#0d9488",
              color: "#fff",
              borderRadius: 10,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Open checkout →
          </Link>
        </div>
      </main>
    );
  }

  const paidIso = link.paid_at
    ? new Date(link.paid_at * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "—";
  const methodLabel =
    (link.paid_method && METHOD_LABELS[link.paid_method]) ||
    link.paid_method ||
    "Card";
  const last4 = link.paid_last4 ? `•••• ${link.paid_last4}` : "—";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "44px 20px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body, main { background: #fff !important; }
            .receipt-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          }
        `}
      </style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <Link
            href="/payments"
            style={{
              color: "#0d9488",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="javascript:window.print()"
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                background: "#0f172a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              🖨 Print
            </a>
            <Link
              href={`/pay/${id}`}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.15)",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Original link
            </Link>
          </div>
        </div>

        <div
          className="receipt-card"
          style={{
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 18,
            padding: 36,
            boxShadow: "0 12px 36px rgba(15,23,42,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
              paddingBottom: 22,
              borderBottom: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  A
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "#475569",
                    textTransform: "uppercase",
                  }}
                >
                  AEVION Payments Rail
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                Receipt
              </h1>
            </div>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "#dcfce7",
                color: "#14532d",
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Paid
            </div>
          </div>

          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              marginBottom: 6,
            }}
          >
            {formatAmount(link.amount, link.currency)}
          </div>
          <div style={{ fontSize: 17, color: "#475569", marginBottom: 26 }}>
            {link.title}
          </div>

          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px 32px",
              margin: 0,
              fontSize: 14,
            }}
          >
            <Field label="Receipt for" value={link.id} mono />
            <Field label="Paid at" value={paidIso} mono />
            <Field label="Method" value={methodLabel} />
            <Field label="Card" value={last4} mono />
            <Field
              label="Settlement"
              value={link.settlement === "bank" ? "AEVION Bank" : "AEC Wallet"}
            />
            <Field label="Currency" value={link.currency} />
          </dl>

          {link.description && (
            <div
              style={{
                marginTop: 26,
                padding: "14px 16px",
                background: "#f8fafc",
                border: "1px solid rgba(15,23,42,0.06)",
                borderRadius: 12,
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {link.description}
            </div>
          )}

          <div
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: "1px solid rgba(15,23,42,0.08)",
              fontSize: 12,
              color: "#94a3b8",
              lineHeight: 1.55,
            }}
          >
            This receipt was issued by AEVION Payments Rail. Verify any time at{" "}
            <code style={{ color: "#0f172a" }}>/api/pay/{id}</code>. Refunds, if
            any, are listed under{" "}
            <code style={{ color: "#0f172a" }}>/api/payments/v1/refunds?link_id={id}</code>.
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#94a3b8",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "#0f172a",
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
