"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

export default function PricingAffiliatePage() {
  const tp = usePricingT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [channel, setChannel] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/affiliate" });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/affiliate/apply"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim() || undefined,
          country: country.trim() || undefined,
          channel: channel.trim() || undefined,
          details: details.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setStatus("ok");
      setAppId(j.id ?? null);
      track({ type: "affiliate_apply", source: "pricing/affiliate" });
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
            background: "linear-gradient(135deg, #be185d, #ec4899)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("affiliate.badge")}
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
          {tp("affiliate.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("affiliate.subtitle")}
        </p>
      </section>

      {/* Numbers */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
          marginBottom: 32,
          padding: "16px 12px",
          background: "rgba(190,24,93,0.05)",
          borderRadius: 14,
          border: "1px solid rgba(190,24,93,0.15)",
        }}
      >
        <Stat value="20%" label={tp("affiliate.stat.commission")} />
        <Stat value={tp("affiliate.stat.lifetimeValue")} label={tp("affiliate.stat.lifetime")} />
        <Stat value="60d" label={tp("affiliate.stat.cookie")} />
        <Stat value="$50" label={tp("affiliate.stat.minPayout")} />
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {tp("affiliate.how.title")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                padding: 18,
                background: "#fff",
                border: BORDER,
                borderRadius: 12,
                boxShadow: CARD,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #be185d, #ec4899)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                {n}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 6, color: "#0f172a" }}>
                {tp(`affiliate.how.s${n}.title`)}
              </h3>
              <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.55 }}>
                {tp(`affiliate.how.s${n}.body`)}
              </p>
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
          {tp("affiliate.form.title")}
        </h2>
        <p style={{ color: "#475569", margin: 0, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          {tp("affiliate.form.subtitle")}
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
              ✓ {tp("affiliate.success.title")}
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {tp("affiliate.success.body")}
            </p>
            {appId && (
              <p style={{ margin: 0, marginTop: 10, fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#065f46" }}>
                {tp("affiliate.success.id")} <strong>{appId}</strong>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label={tp("affiliate.field.name")}
              value={name}
              onChange={setName}
              required
              placeholder={tp("affiliate.placeholder.name")}
            />
            <Field
              label={tp("affiliate.field.email")}
              value={email}
              onChange={setEmail}
              type="email"
              required
              placeholder={tp("affiliate.placeholder.email")}
            />
            <Field
              label={tp("affiliate.field.organization")}
              value={organization}
              onChange={setOrganization}
              placeholder={tp("affiliate.placeholder.organization")}
            />
            <Field
              label={tp("affiliate.field.country")}
              value={country}
              onChange={setCountry}
              placeholder={tp("affiliate.placeholder.country")}
            />
            <Field
              label={tp("affiliate.field.channel")}
              value={channel}
              onChange={setChannel}
              placeholder={tp("affiliate.placeholder.channel")}
              full
            />
            <Field
              label={tp("affiliate.field.details")}
              value={details}
              onChange={setDetails}
              placeholder={tp("affiliate.placeholder.details")}
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
                  background: "linear-gradient(135deg, #be185d, #ec4899)",
                  color: "#fff",
                }}
              >
                {status === "submitting" ? tp("affiliate.form.submitting") : tp("affiliate.form.submit")}
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>{tp("affiliate.form.hint")}</span>
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
                {tp("affiliate.form.error")}: {errorMsg}
              </div>
            )}
          </form>
        )}
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {tp("affiliate.faq.title")}
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
                {tp(`affiliate.faq.q${n}`)}
              </summary>
              <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                {tp(`affiliate.faq.a${n}`)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </ProductPageShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 6px" }}>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: "#be185d" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
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
