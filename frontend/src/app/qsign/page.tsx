"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

/* ───────── RFC 8785-compatible canonicalization (mirrors backend lib/qsignV2/canonicalize.ts) ─────────
 * Same algorithm the server uses: keys sorted lex, no whitespace, undefined rejected.
 * Output is a preview; the signature in the response is the authoritative canonical form.
 */
function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new Error("non-finite number");
    return value;
  }
  if (t === "string" || t === "boolean") return value;
  if (t === "undefined") throw new Error("undefined is not JSON");
  if (Array.isArray(value)) return (value as unknown[]).map(canonicalize);
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k];
      if (typeof v === "undefined") continue;
      out[k] = canonicalize(v);
    }
    return out;
  }
  throw new Error("unsupported type: " + t);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ───────── response types (match /api/qsign/v2/*) ───────── */

type Health = {
  status: string;
  service: string;
  algoVersion: string;
  canonicalization: string;
  activeKeys: { hmac: string; ed25519: string };
};

type SignResponse = {
  id: string;
  algoVersion: string;
  canonicalization: string;
  payloadHash: string;
  payloadCanonical: string;
  hmac: { kid: string; algo: string; signature: string };
  ed25519: { kid: string; algo: string; signature: string; publicKey: string };
  issuer: { userId: string | null; email: string | null };
  geo: {
    source: string | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  createdAt: string;
  verifyUrl: string;
  publicUrl: string;
};

type VerifyResponse = {
  valid: boolean;
  algoVersion: string;
  canonicalization: string;
  payloadHash: string;
  hmac: { kid: string; valid: boolean };
  ed25519: { kid: string | null; valid: boolean | null };
  stateless?: boolean;
};

/* ───────── shared styles ───────── */

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  boxSizing: "border-box",
};
const mono: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#334155",
};
const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const chip = (bg: string, fg: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "ui-monospace, monospace",
});

export default function QSignPage() {
  const { showToast } = useToast();

  // payload + client-side canonical preview
  const [payloadText, setPayloadText] = useState(
    '{\n  "hello": "AEVION",\n  "ts": 1714000000\n}',
  );
  const [payloadOrigin, setPayloadOrigin] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<string>("");
  const [payloadHash, setPayloadHash] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const [showCanonical, setShowCanonical] = useState(false);

  // health
  const [health, setHealth] = useState<Health | null>(null);

  // auth
  const [token, setToken] = useState<string>("");
  const [showToken, setShowToken] = useState(false);

  // gps opt-in
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "denied">("idle");

  // sign flow
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState<SignResponse | null>(null);
  const [hashAtSign, setHashAtSign] = useState<string>("");

  // verify pane
  const [verifyPayload, setVerifyPayload] = useState("");
  const [verifyHmacSig, setVerifyHmacSig] = useState("");
  const [verifyHmacKid, setVerifyHmacKid] = useState("");
  const [verifyEdSig, setVerifyEdSig] = useState("");
  const [verifyEdKid, setVerifyEdKid] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);

  /* — mount: deep-link payload + token pickup — */
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("payload");
      if (raw) {
        const decoded = decodeURIComponent(raw);
        JSON.parse(decoded);
        setPayloadText(decoded);
        setPayloadOrigin("deep link (QRight / Globus)");
      }
    } catch {}
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) setToken(t);
    } catch {}
  }, []);

  /* — health probe — */
  useEffect(() => {
    fetch(apiUrl("/api/qsign/v2/health"))
      .then((r) => r.json())
      .then((d: Health) => setHealth(d))
      .catch(() => setHealth(null));
  }, []);

  /* — live canonical + hash on every payload edit — */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const parsed = JSON.parse(payloadText);
        const c = canonicalJson(parsed);
        const h = await sha256Hex(c);
        if (cancelled) return;
        setCanonical(c);
        setPayloadHash(h);
        setParseError("");
      } catch (e: any) {
        if (cancelled) return;
        setCanonical("");
        setPayloadHash("");
        setParseError(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payloadText]);

  const hashDrift =
    !!signed && !!hashAtSign && !!payloadHash && hashAtSign !== payloadHash;

  const requestGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("denied");
      showToast("Geolocation not supported", "error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("idle");
        showToast("GPS attached", "success");
      },
      () => {
        setGps(null);
        setGpsStatus("denied");
        showToast("GPS permission denied", "error");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  const clearGps = () => {
    setGps(null);
    setGpsStatus("idle");
  };

  const copy = async (txt: string, what: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      showToast(`${what} copied`, "success");
    } catch {
      showToast("Copy failed", "error");
    }
  };

  /* — sign — */
  const sign = async () => {
    if (!token.trim()) {
      showToast("Bearer token required — sign in at /auth", "error");
      return;
    }
    if (parseError) {
      showToast("Fix JSON before signing", "error");
      return;
    }
    setSigning(true);
    try {
      const payload = JSON.parse(payloadText);
      const body: Record<string, unknown> = { payload };
      if (gps) body.gps = gps;
      const res = await fetch(apiUrl("/api/qsign/v2/sign"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || `Sign failed (${res.status})`, "error");
        setSigned(null);
        return;
      }
      const sr = data as SignResponse;
      setSigned(sr);
      setHashAtSign(sr.payloadHash);
      // prefill verify pane with fresh sig so user can click Verify immediately
      setVerifyPayload(JSON.stringify(payload, null, 2));
      setVerifyHmacSig(sr.hmac.signature);
      setVerifyHmacKid(sr.hmac.kid);
      setVerifyEdSig(sr.ed25519.signature);
      setVerifyEdKid(sr.ed25519.kid);
      setVerifyResult(null);
      showToast("Signed · id " + sr.id.slice(0, 8), "success");
    } catch (e: any) {
      showToast("Sign error: " + (e?.message || String(e)), "error");
    } finally {
      setSigning(false);
    }
  };

  /* — stateless verify — */
  const verify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const payload = JSON.parse(verifyPayload);
      const body: Record<string, unknown> = {
        payload,
        signatureHmac: verifyHmacSig,
      };
      if (verifyHmacKid) body.hmacKid = verifyHmacKid;
      if (verifyEdSig && verifyEdKid) {
        body.ed25519Kid = verifyEdKid;
        body.signatureEd25519 = verifyEdSig;
      }
      const res = await fetch(apiUrl("/api/qsign/v2/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || `Verify failed (${res.status})`, "error");
        return;
      }
      setVerifyResult(data as VerifyResponse);
      showToast(data.valid ? "Signature VALID" : "Signature INVALID", data.valid ? "success" : "error");
    } catch (e: any) {
      showToast("Verify error: " + (e?.message || String(e)), "error");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main>
      <ProductPageShell maxWidth={1080}>
        <Wave1Nav />
        <PipelineSteps current="qsign" />

        {/* ─── Hero ─── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              padding: "26px 26px 20px",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  QSign v2 — Unique Digital Signature
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    opacity: 0.85,
                    lineHeight: 1.5,
                    maxWidth: 680,
                  }}
                >
                  RFC 8785 canonical JSON + HMAC-SHA256 + Ed25519 hybrid. Every signature is
                  persisted, revocable, geo-anchored, and independently verifiable via a public
                  URL.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "flex-end",
                }}
              >
                {health ? (
                  <>
                    <span style={chip("rgba(16,185,129,0.18)", "#a7f3d0")}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#10b981",
                        }}
                      />
                      {health.status} · {health.algoVersion}
                    </span>
                    <span style={chip("rgba(255,255,255,0.10)", "#e2e8f0")}>
                      hmac: {health.activeKeys.hmac}
                    </span>
                    <span style={chip("rgba(255,255,255,0.10)", "#e2e8f0")}>
                      ed25519: {health.activeKeys.ed25519}
                    </span>
                  </>
                ) : (
                  <span style={chip("rgba(239,68,68,0.18)", "#fecaca")}>offline</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Deep-link banner ─── */}
        {payloadOrigin ? (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,118,110,0.25)",
              background: "rgba(15,118,110,0.06)",
              fontSize: 13,
              color: "#0f766e",
              fontWeight: 600,
            }}
          >
            Payload received from: {payloadOrigin}
          </div>
        ) : null}

        {/* ─── Nav chips ─── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Link
            href="/qright"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              textDecoration: "none",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ← QRight
          </Link>
          <Link
            href="/bureau"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              textDecoration: "none",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            IP Bureau →
          </Link>
          <Link
            href="/planet"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              textDecoration: "none",
              color: "#0f766e",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Planet
          </Link>
          <Link
            href="/qsign/keys"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px dashed rgba(15,23,42,0.25)",
              textDecoration: "none",
              color: "#475569",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Key registry
          </Link>
        </div>

        {/* ─── Auth row ─── */}
        <div style={{ ...card, marginBottom: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Auth</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer token (auto-filled from /auth)"
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
            <button
              onClick={() => setShowToken((s) => !s)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showToken ? "Hide" : "Show"}
            </button>
            {!token ? (
              <Link
                href="/auth"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Sign in →
              </Link>
            ) : (
              <span style={chip("rgba(16,185,129,0.12)", "#047857")}>token loaded</span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          }}
        >
          {/* ═══ LEFT: Sign ═══ */}
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>1. Sign payload</div>

            <div style={{ marginBottom: 12 }}>
              <div style={label}>Payload (JSON)</div>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={8}
                style={{ ...inputStyle, ...mono, resize: "vertical" }}
              />
              {parseError ? (
                <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                  JSON error: {parseError}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                  ✓ Valid JSON
                </div>
              )}
            </div>

            {/* canonical + hash */}
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid rgba(15,23,42,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <div style={label}>RFC 8785 canonical · SHA-256</div>
                <button
                  onClick={() => setShowCanonical((s) => !s)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f766e",
                    cursor: "pointer",
                  }}
                >
                  {showCanonical ? "hide canonical" : "show canonical"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ ...mono, flex: 1, wordBreak: "break-all", fontSize: 11 }}>
                  {payloadHash || "—"}
                </code>
                {payloadHash ? (
                  <button
                    onClick={() => copy(payloadHash, "Hash")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    copy
                  </button>
                ) : null}
              </div>
              {showCanonical && canonical ? (
                <pre
                  style={{
                    ...mono,
                    marginTop: 8,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 10,
                    borderRadius: 8,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontSize: 11,
                    marginBottom: 0,
                  }}
                >
                  {canonical}
                </pre>
              ) : null}
              {hashDrift ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(234,88,12,0.08)",
                    border: "1px solid rgba(234,88,12,0.25)",
                    color: "#9a3412",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  ⚠ Canonical hash changed since signing — the stored signature will no longer
                  verify against this payload.
                </div>
              ) : null}
            </div>

            {/* GPS opt-in */}
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo anchoring</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {gps
                    ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)} (high priority)`
                    : gpsStatus === "denied"
                    ? "Permission denied — server will use IP-based geo"
                    : "Opt-in to attach device GPS; otherwise server infers from IP"}
                </div>
              </div>
              {gps ? (
                <button
                  onClick={clearGps}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.15)",
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              ) : (
                <button
                  onClick={requestGps}
                  disabled={gpsStatus === "loading"}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.15)",
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {gpsStatus === "loading" ? "Requesting…" : "Attach GPS"}
                </button>
              )}
            </div>

            <button
              onClick={sign}
              disabled={signing || !!parseError || !token}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: 10,
                border: "none",
                background:
                  signing || !!parseError || !token ? "#94a3b8" : "#0f172a",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor:
                  signing || !!parseError || !token ? "default" : "pointer",
              }}
            >
              {signing ? "Signing…" : "Sign with HMAC + Ed25519"}
            </button>

            {/* signed result */}
            {signed ? (
              <div
                style={{
                  marginTop: 16,
                  borderTop: "1px solid rgba(15,23,42,0.08)",
                  paddingTop: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={chip("rgba(16,185,129,0.12)", "#047857")}>signed</span>
                  <code style={{ ...mono, fontSize: 11 }}>{signed.id}</code>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <SigRow
                    label={`HMAC · ${signed.hmac.kid}`}
                    value={signed.hmac.signature}
                    onCopy={() => copy(signed.hmac.signature, "HMAC signature")}
                  />
                  <SigRow
                    label={`Ed25519 · ${signed.ed25519.kid}`}
                    value={signed.ed25519.signature}
                    onCopy={() => copy(signed.ed25519.signature, "Ed25519 signature")}
                  />
                  <SigRow
                    label="Ed25519 public key"
                    value={signed.ed25519.publicKey}
                    onCopy={() => copy(signed.ed25519.publicKey, "Public key")}
                  />
                  {signed.geo ? (
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      geo: {signed.geo.source}
                      {signed.geo.country ? ` · ${signed.geo.country}` : ""}
                      {signed.geo.city ? ` · ${signed.geo.city}` : ""}
                      {signed.geo.lat !== null && signed.geo.lng !== null
                        ? ` · ${signed.geo.lat.toFixed(3)}, ${signed.geo.lng.toFixed(3)}`
                        : ""}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={signed.publicUrl}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#0d9488",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Open public verify page →
                  </Link>
                  <button
                    onClick={() => copy(JSON.stringify(signed, null, 2), "Full response")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* ═══ RIGHT: Verify (stateless) ═══ */}
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>2. Verify (stateless)</div>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              Re-canonicalizes the payload server-side and recomputes both signatures. No DB
              lookup. For DB-backed verify + revocation check, open the public URL after signing.
            </p>

            <div style={{ marginBottom: 10 }}>
              <div style={label}>Payload (JSON)</div>
              <textarea
                value={verifyPayload}
                onChange={(e) => setVerifyPayload(e.target.value)}
                rows={5}
                style={{ ...inputStyle, ...mono, resize: "vertical" }}
                placeholder='{ "hello": "AEVION" }'
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "auto 1fr",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={label}>HMAC kid</div>
              <input
                value={verifyHmacKid}
                onChange={(e) => setVerifyHmacKid(e.target.value)}
                placeholder="leave empty → active"
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>HMAC sig</div>
              <input
                value={verifyHmacSig}
                onChange={(e) => setVerifyHmacSig(e.target.value)}
                placeholder="64 hex chars"
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>Ed25519 kid</div>
              <input
                value={verifyEdKid}
                onChange={(e) => setVerifyEdKid(e.target.value)}
                placeholder="optional"
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>Ed25519 sig</div>
              <input
                value={verifyEdSig}
                onChange={(e) => setVerifyEdSig(e.target.value)}
                placeholder="optional · 128 hex"
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
            </div>

            <button
              onClick={verify}
              disabled={verifying || !verifyHmacSig || !verifyPayload}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: 10,
                border: "none",
                background:
                  verifying || !verifyHmacSig || !verifyPayload ? "#94a3b8" : "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor:
                  verifying || !verifyHmacSig || !verifyPayload ? "default" : "pointer",
              }}
            >
              {verifying ? "Verifying…" : "Verify"}
            </button>

            {verifyResult ? (
              <div
                style={{
                  marginTop: 14,
                  borderTop: "1px solid rgba(15,23,42,0.08)",
                  paddingTop: 12,
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  {verifyResult.valid ? (
                    <span style={chip("rgba(16,185,129,0.15)", "#047857")}>✓ VALID</span>
                  ) : (
                    <span style={chip("rgba(239,68,68,0.15)", "#b91c1c")}>✗ INVALID</span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <div>
                    HMAC ({verifyResult.hmac.kid}):{" "}
                    <strong
                      style={{ color: verifyResult.hmac.valid ? "#047857" : "#b91c1c" }}
                    >
                      {verifyResult.hmac.valid ? "valid" : "invalid"}
                    </strong>
                  </div>
                  {verifyResult.ed25519.kid !== null ? (
                    <div>
                      Ed25519 ({verifyResult.ed25519.kid}):{" "}
                      <strong
                        style={{
                          color:
                            verifyResult.ed25519.valid === null
                              ? "#64748b"
                              : verifyResult.ed25519.valid
                              ? "#047857"
                              : "#b91c1c",
                        }}
                      >
                        {verifyResult.ed25519.valid === null
                          ? "not checked"
                          : verifyResult.ed25519.valid
                          ? "valid"
                          : "invalid"}
                      </strong>
                    </div>
                  ) : null}
                  <div style={{ ...mono, color: "#64748b", fontSize: 11 }}>
                    hash: {verifyResult.payloadHash}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── How it works ─── */}
        <div
          style={{
            marginTop: 24,
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 14,
            padding: 18,
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
            How QSign v2 works
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 13,
              color: "#475569",
              lineHeight: 1.7,
            }}
          >
            <li>
              Your payload is canonicalized per <strong>RFC 8785 (JCS)</strong> — keys sorted, no
              whitespace, deterministic across clients.
            </li>
            <li>
              SHA-256 of the canonical form is signed with two independent keys:
              <strong> HMAC-SHA256</strong> (shared secret) and <strong> Ed25519</strong> (public
              verifiable).
            </li>
            <li>
              The signature row is persisted with issuer, geo, and key IDs. A shareable public URL
              verifies it without secrets.
            </li>
            <li>
              Keys rotate with an overlap window — retired keys remain valid for verifying
              historical signatures forever.
            </li>
            <li>
              Any signature can be revoked by its issuer (or admin). Revoked rows stay
              cryptographically valid but report <code>valid=false</code>.
            </li>
          </ol>
        </div>
      </ProductPageShell>
    </main>
  );
}

/* ───────── sub-components ───────── */

function SigRow({
  label: labelText,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 8,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid rgba(15,23,42,0.05)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 2,
          }}
        >
          {labelText}
        </div>
        <code
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "#334155",
            wordBreak: "break-all",
            display: "block",
          }}
        >
          {value}
        </code>
      </div>
      <button
        onClick={onCopy}
        style={{
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid rgba(15,23,42,0.15)",
          background: "#fff",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        copy
      </button>
    </div>
  );
}
