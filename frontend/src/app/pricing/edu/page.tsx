"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const TIERS = [
  {
    id: "student",
    icon: "🎓",
    color: "#0d9488",
    title: "edu.tier.student.title",
    body: "edu.tier.student.body",
    eligibility: ["edu.tier.student.e1", "edu.tier.student.e2", "edu.tier.student.e3"],
  },
  {
    id: "professor",
    icon: "📚",
    color: "#0ea5e9",
    title: "edu.tier.professor.title",
    body: "edu.tier.professor.body",
    eligibility: ["edu.tier.professor.e1", "edu.tier.professor.e2", "edu.tier.professor.e3"],
  },
  {
    id: "university",
    icon: "🏛",
    color: "#7c3aed",
    title: "edu.tier.university.title",
    body: "edu.tier.university.body",
    eligibility: ["edu.tier.university.e1", "edu.tier.university.e2", "edu.tier.university.e3"],
  },
] as const;

export default function PricingEduPage() {
  const tp = usePricingT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [institutionDomain, setInstitutionDomain] = useState("");
  const [country, setCountry] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/edu" });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !organization.trim()) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/edu/apply"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim(),
          institutionDomain: institutionDomain.trim() || undefined,
          country: country.trim() || undefined,
          details: details.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setStatus("ok");
      setAppId(j.id ?? null);
      track({ type: "edu_apply", source: "pricing/edu" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <ProductPageShell maxWidth={960}>
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
            background: "linear-gradient(135deg, #065f46, #10b981)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("edu.badge")}
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
          {tp("edu.title")}
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
          {tp("edu.subtitle")}
        </p>
      </section>

      {/* Tiers */}
      <section style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {TIERS.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 24,
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                boxShadow: CARD,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: t.color,
                  color: "#fff",
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
                  fontSize: 18,
                  fontWeight: 900,
                  margin: 0,
                  marginBottom: 8,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                {tp(t.title)}
              </h3>
              <p style={{ fontSize: 13, color: "#475569", margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
                {tp(t.body)}
              </p>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: t.color,
                  marginBottom: 8,
                }}
              >
                {tp("edu.eligibility")}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, lineHeight: 1.6 }}>
                {t.eligibility.map((e, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, paddingTop: 4, color: "#475569" }}>
                    <span style={{ color: t.color, fontWeight: 800, flexShrink: 0 }}>✓</span>
                    <span>{tp(e)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
          {tp("edu.form.title")}
        </h2>
        <p style={{ color: "#475569", margin: 0, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          {tp("edu.form.subtitle")}
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
              ✓ {tp("edu.success.title")}
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {tp("edu.success.body")}
            </p>
            {appId && (
              <p style={{ margin: 0, marginTop: 10, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                {tp("edu.success.id")} <strong>{appId}</strong>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label={tp("edu.field.name")}
              value={name}
              onChange={setName}
              required
              placeholder={tp("edu.placeholder.name")}
            />
            <Field
              label={tp("edu.field.email")}
              value={email}
              onChange={setEmail}
              type="email"
              required
              placeholder={tp("edu.placeholder.email")}
            />
            <Field
              label={tp("edu.field.organization")}
              value={organization}
              onChange={setOrganization}
              required
              placeholder={tp("edu.placeholder.organization")}
            />
            <Field
              label={tp("edu.field.institutionDomain")}
              value={institutionDomain}
              onChange={setInstitutionDomain}
              placeholder={tp("edu.placeholder.institutionDomain")}
            />
            <Field
              label={tp("edu.field.country")}
              value={country}
              onChange={setCountry}
              placeholder={tp("edu.placeholder.country")}
            />
            <Field
              label={tp("edu.field.details")}
              value={details}
              onChange={setDetails}
              placeholder={tp("edu.placeholder.details")}
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
                  background: "linear-gradient(135deg, #065f46, #10b981)",
                  color: "#fff",
                }}
              >
                {status === "submitting" ? tp("edu.form.submitting") : tp("edu.form.submit")}
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>{tp("edu.form.hint")}</span>
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
                {tp("edu.form.error")}: {errorMsg}
              </div>
            )}
          </form>
        )}
      </section>

      {/* Use cases / examples */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
          {tp("edu.examples.title")}
        </h2>
        <p style={{ color: "#475569", margin: 0, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          {tp("edu.examples.subtitle")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                padding: 18,
                background: "linear-gradient(135deg, rgba(6,95,70,0.04), rgba(16,185,129,0.04))",
                border: "1px solid rgba(6,95,70,0.15)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#065f46",
                  marginBottom: 6,
                }}
              >
                {tp(`edu.examples.e${n}.tag`)}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 6, color: "#0f172a" }}>
                {tp(`edu.examples.e${n}.title`)}
              </h3>
              <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                {tp(`edu.examples.e${n}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {tp("edu.faq.title")}
        </h2>
        <div>
          {[1, 2, 3, 4].map((n) => (
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
                {tp(`edu.faq.q${n}`)}
              </summary>
              <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                {tp(`edu.faq.a${n}`)}
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
