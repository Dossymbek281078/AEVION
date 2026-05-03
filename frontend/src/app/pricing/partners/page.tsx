"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

type PartnerType = "reseller" | "system_integrator" | "agency";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const PARTNER_TIERS: Array<{
  id: PartnerType;
  icon: string;
  color: string;
  bg: string;
  badge: string;
  margin: string;
}> = [
  { id: "reseller", icon: "🤝", color: "#0d9488", bg: "rgba(13,148,136,0.06)", badge: "30% margin", margin: "30%" },
  { id: "system_integrator", icon: "⚙", color: "#0ea5e9", bg: "rgba(14,165,233,0.06)", badge: "20% rev share", margin: "20%" },
  { id: "agency", icon: "🎨", color: "#7c3aed", bg: "rgba(124,58,237,0.06)", badge: "white-label", margin: "—" },
];

const COMPARE_ROWS = [
  ["partners.compare.who", "Перепродаёт лицензии", "Внедряет и кастомизирует", "White-label, ребрендинг"],
  ["partners.compare.fee", "30% маржа на каждой подписке", "20% revenue share + project fee", "Custom (от 40%)"],
  ["partners.compare.commitment", "Quarterly target $5k+", "Active deal pipeline", "Ребрендинг + custom domain"],
  ["partners.compare.support", "Sales-deck + demo-account", "Tech-onboarding + Slack-канал", "Co-marketing fund"],
  ["partners.compare.training", "8h sales certification", "40h technical certification", "Brand kit + dev access"],
  ["partners.compare.payouts", "NET-30 после оплаты клиентом", "Quarterly settle", "Monthly invoice"],
];

export default function PricingPartnersPage() {
  const tp = usePricingT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType>("reseller");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/partners" });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !organization.trim()) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/partners/apply"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim(),
          country: country.trim() || undefined,
          partnerType,
          details: details.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setStatus("ok");
      setAppId(j.id ?? null);
      track({ type: "partner_apply", source: "pricing/partners" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <ProductPageShell maxWidth={1080}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("partners.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("partners.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 680,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("partners.subtitle")}
        </p>
      </section>

      {/* Partner type cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginBottom: 36,
        }}
      >
        {PARTNER_TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setPartnerType(t.id);
              document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              padding: 24,
              background: partnerType === t.id ? `linear-gradient(180deg, #0f172a, #1e293b)` : "#fff",
              color: partnerType === t.id ? "#f8fafc" : "#0f172a",
              border: partnerType === t.id ? "none" : BORDER,
              borderRadius: 14,
              boxShadow: partnerType === t.id ? "0 12px 40px rgba(15,23,42,0.25)" : CARD,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "transform 0.15s ease",
              transform: partnerType === t.id ? "translateY(-4px)" : "none",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: partnerType === t.id ? "rgba(255,255,255,0.1)" : t.bg,
                color: partnerType === t.id ? "#5eead4" : t.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                marginBottom: 14,
              }}
            >
              {t.icon}
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 900,
                margin: 0,
                marginBottom: 8,
                letterSpacing: "-0.02em",
              }}
            >
              {tp(`partners.tier.${t.id}.title`)}
            </h3>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: partnerType === t.id ? "#5eead4" : t.color,
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              {t.badge}
            </div>
            <p
              style={{
                fontSize: 13,
                color: partnerType === t.id ? "#cbd5e1" : "#475569",
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              {tp(`partners.tier.${t.id}.body`)}
            </p>
          </button>
        ))}
      </section>

      {/* Comparison table */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          {tp("partners.compare.title")}
        </h2>
        <div
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: CARD,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#475569", width: "26%" }}>
                    {tp("partners.compare.col1")}
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#0d9488" }}>
                    {tp("partners.tier.reseller.title")}
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#0ea5e9" }}>
                    {tp("partners.tier.system_integrator.title")}
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#7c3aed" }}>
                    {tp("partners.tier.agency.title")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                      background: i % 2 === 1 ? "#fafbfd" : "#fff",
                    }}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0f172a" }}>{tp(row[0])}</td>
                    {row.slice(1).map((c, j) => (
                      <td key={j} style={{ padding: "12px 14px", textAlign: "center", color: "#475569" }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Apply form */}
      <section
        id="apply"
        style={{
          marginBottom: 36,
          padding: 28,
          background: "#fff",
          border: BORDER,
          borderRadius: 16,
          boxShadow: CARD,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {tp("partners.form.title")}
        </h2>
        <p style={{ color: "#475569", margin: 0, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          {tp("partners.form.subtitle")}
        </p>
        {status === "ok" ? (
          <div
            style={{
              padding: 20,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 12,
              color: "#065f46",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
              ✓ {tp("partners.success.title")}
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {tp("partners.success.body")}
            </p>
            {appId && (
              <p style={{ margin: 0, marginTop: 10, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                {tp("partners.success.id")} <strong>{appId}</strong>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {tp("partners.field.partnerType")} <span style={{ color: "#dc2626" }}>*</span>
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PARTNER_TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPartnerType(t.id)}
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: partnerType === t.id ? "none" : "1px solid rgba(15,23,42,0.12)",
                      cursor: "pointer",
                      background: partnerType === t.id ? t.color : "#fff",
                      color: partnerType === t.id ? "#fff" : t.color,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    {tp(`partners.tier.${t.id}.title`)}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label={tp("partners.field.name")}
              value={name}
              onChange={setName}
              required
              placeholder={tp("partners.placeholder.name")}
            />
            <Field
              label={tp("partners.field.email")}
              value={email}
              onChange={setEmail}
              type="email"
              required
              placeholder={tp("partners.placeholder.email")}
            />
            <Field
              label={tp("partners.field.organization")}
              value={organization}
              onChange={setOrganization}
              required
              placeholder={tp("partners.placeholder.organization")}
            />
            <Field
              label={tp("partners.field.country")}
              value={country}
              onChange={setCountry}
              placeholder={tp("partners.placeholder.country")}
            />
            <Field
              label={tp("partners.field.details")}
              value={details}
              onChange={setDetails}
              placeholder={tp("partners.placeholder.details")}
              multiline
              full
            />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={status === "submitting"}
                style={{
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: 10,
                  border: "none",
                  cursor: status === "submitting" ? "wait" : "pointer",
                  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  color: "#fff",
                }}
              >
                {status === "submitting" ? tp("partners.form.submitting") : tp("partners.form.submit")}
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>{tp("partners.form.hint")}</span>
            </div>
            {status === "error" && errorMsg && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 12,
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#991b1b",
                }}
              >
                {tp("partners.form.error")}: {errorMsg}
              </div>
            )}
          </form>
        )}
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {tp("partners.faq.title")}
        </h2>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <details
              key={n}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 10,
                marginBottom: 8,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              <summary style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", outline: "none", cursor: "pointer" }}>
                {tp(`partners.faq.q${n}`)}
              </summary>
              <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                {tp(`partners.faq.a${n}`)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </ProductPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  multiline,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  full?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : undefined }}>
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 800,
          color: "#475569",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={inputStyle}
        />
      )}
    </label>
  );
}
