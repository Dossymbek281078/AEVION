"use client";

/**
 * QMaskCard — Charge detail page.
 *
 * Backend limitation: there is NO `GET /api/qmaskcard/charges/:id` single-charge endpoint.
 * We call `GET /api/qmaskcard/charges` with the Bearer token (returns up to 100 most-recent
 * charges for the authed user) and filter client-side by `:id`. If no match is found we
 * render a "not found" card. If/when a `/charges/:id` endpoint ships, swap the fetch.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, use as reactUse } from "react";
import { getApiBase } from "@/lib/apiBase";

type Charge = {
  id: string;
  maskId: string;
  amountCents: number;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  geoCountry: string | null;
  status: "authorized" | "declined";
  declineReason: string | null;
  riskScore: number;
  createdAt: string;
};

type Phase = "hydrating" | "unauth" | "loading" | "not-found" | "error" | "success";

const C = {
  bg: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  accent: "#a78bfa",
  ok: "#34d399",
  warn: "#fbbf24",
  bad: "#ef4444",
  text: "#f1f5f9",
  mute: "#94a3b8",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function humanizeDecline(reason: string | null): string {
  if (!reason) return "Charge was declined";
  const map: Record<string, string> = {
    mask_revoked: "Mask was revoked",
    mask_expired: "Mask had expired",
    mask_not_found: "Mask could not be located",
    mask_inactive: "Mask is no longer active",
    merchant_locked: "Merchant lock prevented charge",
    merchant_blocked: "Merchant is blocklisted",
    category_locked: "Merchant category not allowed",
    geo_locked: "Geographic lock prevented charge",
    geo_blocked: "Country is blocklisted",
    limit_exceeded: "Single-charge limit exceeded",
    spend_limit_exceeded: "Cumulative spend limit exceeded",
    velocity_exceeded: "Too many charges in a short window",
    risk_too_high: "Risk score too high to authorize",
    currency_mismatch: "Currency does not match mask",
    insufficient_funds: "Insufficient funds available",
    duplicate_charge: "Duplicate charge detected",
  };
  if (map[reason]) return map[reason];
  // Fallback: humanize snake_case → "Snake case"
  const pretty = reason.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function riskColor(score: number): string {
  if (score <= 30) return C.ok;
  if (score <= 60) return C.warn;
  return C.bad;
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 0) return "in the future";
  if (sec < 45) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.round(day / 365);
  return `${yr} yr${yr === 1 ? "" : "s"} ago`;
}

function shortId(id: string): string {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function formatMoney(cents: number, currency: string): string {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || ""}`.trim();
  }
}

export default function QMaskCardChargeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);

  const [phase, setPhase] = useState<Phase>("hydrating");
  const [token, setToken] = useState<string | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  // Hydrate: read token from localStorage
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("aevion_token");
      if (!t) {
        setPhase("unauth");
        return;
      }
      setToken(t);
      setPhase("loading");
    } catch {
      setPhase("unauth");
    }
  }, []);

  // Fetch list and filter by id
  useEffect(() => {
    if (phase !== "loading" || !token || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${getApiBase()}/api/qmaskcard/charges`, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (r.status === 401) {
          setPhase("unauth");
          return;
        }
        if (!r.ok) {
          setErrMsg(`Backend responded ${r.status}`);
          setPhase("error");
          return;
        }
        const body = (await r.json()) as { charges?: Charge[] };
        const list = Array.isArray(body?.charges) ? body.charges : [];
        const match = list.find((c) => c && c.id === id) || null;
        if (!match) {
          setPhase("not-found");
          return;
        }
        setCharge(match);
        setPhase("success");
      } catch (err: unknown) {
        if (cancelled) return;
        setErrMsg(err instanceof Error ? err.message : "Network error");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, token, id]);

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "32px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/qmaskcard/dashboard"
          style={{ fontSize: 12, color: C.mute, textDecoration: "none" }}
        >
          ← QMaskCard dashboard
        </Link>

        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "12px 0 6px" }}>Charge detail</h1>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.mute, marginBottom: 20 }}>
          id <span style={{ color: C.text }}>{shortId(id)}</span>
        </div>

        {phase === "hydrating" && <Skeleton label="Loading session…" />}

        {phase === "unauth" && <UnauthCard id={id} />}

        {phase === "loading" && <Skeleton label="Fetching charge…" />}

        {phase === "not-found" && <NotFoundCard id={id} />}

        {phase === "error" && <ErrorCard message={errMsg} />}

        {phase === "success" && charge && <ChargeView charge={charge} />}
      </div>
    </main>
  );
}

/* ───────── states ───────── */

function Skeleton({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: 28,
        background: C.card,
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        textAlign: "center",
        color: C.mute,
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

function UnauthCard({ id }: { id: string }) {
  const next = `/qmaskcard/charges/${encodeURIComponent(id)}`;
  return (
    <div
      style={{
        padding: 22,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Sign in required</div>
      <div style={{ fontSize: 13, color: C.mute, marginBottom: 14 }}>
        Charge details are only visible to the authenticated owner. Sign in to continue.
      </div>
      <Link
        href={`/auth?next=${encodeURIComponent(next)}`}
        style={{
          display: "inline-block",
          padding: "9px 14px",
          background: C.accent,
          color: "#0b0f1d",
          fontWeight: 800,
          fontSize: 13,
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        Sign in →
      </Link>
    </div>
  );
}

function NotFoundCard({ id }: { id: string }) {
  return (
    <div
      style={{
        padding: 22,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Charge not found</div>
      <div style={{ fontSize: 13, color: C.mute, lineHeight: 1.55 }}>
        No charge with id <span style={{ fontFamily: MONO, color: C.text }}>{shortId(id)}</span> was
        found in your last 100 charges. Older charges may not be visible — the backend caps the
        history window at 100 entries per user.
      </div>
      <div style={{ marginTop: 14 }}>
        <Link
          href="/qmaskcard/dashboard"
          style={{ color: C.accent, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 22,
        background: C.card,
        border: `1px solid ${C.bad}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: C.bad }}>
        Could not load charge
      </div>
      <div style={{ fontSize: 13, color: C.mute }}>{message || "Unknown error."}</div>
    </div>
  );
}

/* ───────── success view ───────── */

const cardStyle: React.CSSProperties = {
  padding: 18,
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.mute,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const linkStyle: React.CSSProperties = {
  color: C.accent,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
};

function StatusBanner({ charge }: { charge: Charge }) {
  const ok = charge.status === "authorized";
  const color = ok ? C.ok : C.bad;
  const bg = ok ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.12)";
  const text = ok
    ? "Authorized · Charge captured against mask"
    : `Declined · ${humanizeDecline(charge.declineReason)}`;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        padding: "8px 14px",
        background: bg,
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span>{ok ? "✓" : "✗"}</span>
      <span>{text}</span>
    </div>
  );
}

function ChargeView({ charge }: { charge: Charge }) {
  const created = useMemo(() => {
    const d = new Date(charge.createdAt);
    return Number.isNaN(d.getTime()) ? charge.createdAt : d.toLocaleString();
  }, [charge.createdAt]);

  const ago = timeAgo(charge.createdAt);
  const score = Math.max(0, Math.min(100, Number(charge.riskScore) || 0));
  const rColor = riskColor(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Status banner */}
      <StatusBanner charge={charge} />

      {/* 2. Amount hero card */}
      <section
        style={{
          ...cardStyle,
          padding: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={labelStyle}>Amount</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: C.text, lineHeight: 1.05, marginTop: 4 }}>
            {formatMoney(charge.amountCents, charge.currency)}
          </div>
          <div style={{ fontSize: 13, color: C.mute, marginTop: 6 }}>
            to{" "}
            <span style={{ color: C.text, fontWeight: 600 }}>
              {charge.merchantName ? charge.merchantName : "unknown merchant"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: C.mute, flex: "0 0 auto" }}>
          <div>{created}</div>
          <div style={{ marginTop: 4, color: C.text }}>{ago}</div>
        </div>
      </section>

      {/* 3. Risk-score card */}
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={labelStyle}>Risk score</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: rColor }}>{score}</div>
        </div>
        <div
          aria-label={`Risk gauge ${score} of 100`}
          style={{
            position: "relative",
            width: "100%",
            height: 10,
            background: "#0b1224",
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: `${score}%`,
              background: `linear-gradient(90deg, ${C.ok} 0%, ${C.warn} 60%, ${C.bad} 100%)`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.mute, marginTop: 6 }}>
          <span>0</span><span>30</span><span>60</span><span>100</span>
        </div>
        <p style={{ fontSize: 12, color: C.mute, lineHeight: 1.5, marginTop: 12, marginBottom: 0 }}>
          Combines amount-vs-limit, velocity (charges/hr), geo, off-hour. Above 60 typically reviewed.
        </p>
      </section>

      {/* 4. Merchant card */}
      <section style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Merchant</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, columnGap: 14, fontSize: 13 }}>
          <span style={{ color: C.mute }}>Name</span>
          <span style={{ color: C.text }}>{charge.merchantName ?? "—"}</span>
          <span style={{ color: C.mute }}>Category</span>
          <span style={{ color: C.text }}>{charge.merchantCategory ?? "—"}</span>
          <span style={{ color: C.mute }}>Country</span>
          <span style={{ color: C.text }}>{charge.geoCountry ?? "—"}</span>
        </div>
      </section>

      {/* 5. Mask link card */}
      <section style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Mask</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          This charge was authorized against mask{" "}
          <span style={{ fontFamily: MONO, color: C.accent, fontWeight: 700 }}>{shortId(charge.maskId)}</span>.
        </div>
        <div style={{ marginTop: 10 }}>
          <Link href="/qmaskcard/dashboard" style={linkStyle}>
            Open dashboard to view all charges for this mask →
          </Link>
        </div>
      </section>

      {/* 6. Audit pointer */}
      <section style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Audit trail</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          This charge has a settlement entry on the VeilNetX ledger (fire-and-forget recorded at
          authorize-time).
        </div>
        <div style={{ marginTop: 10 }}>
          <Link href="/veilnetx/ledger" style={linkStyle}>View chain →</Link>
        </div>
      </section>
    </div>
  );
}
