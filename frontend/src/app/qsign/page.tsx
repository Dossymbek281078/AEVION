"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
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

type DilithiumPreview = {
  algo: "ML-DSA-65";
  kid: string;
  mode: "preview";
  digest: string;
  valid: boolean | null;
  note: string;
};

type SignResponse = {
  id: string;
  algoVersion: string;
  canonicalization: string;
  payloadHash: string;
  payloadCanonical: string;
  hmac: { kid: string; algo: string; signature: string };
  ed25519: { kid: string; algo: string; signature: string; publicKey: string };
  dilithium: DilithiumPreview | null;
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
  dilithium: DilithiumPreview | null;
  stateless?: boolean;
};

type RateLimitInfo = {
  limit: number;
  remaining: number;
  resetAt: number | null;
};

type StatsResponse = {
  algoVersion: string;
  canonicalization: string;
  signatures: { total: number; active: number; revoked: number; last24h: number };
  issuers: { unique: number };
  geo: {
    uniqueCountries: number;
    topCountries: { country: string; count: number }[];
  };
  keys: Record<string, { active: number; retired: number }>;
  asOf: string;
};

type RecentItem = {
  id: string;
  algoVersion: string;
  hmacKid: string;
  ed25519Kid: string | null;
  createdAt: string | null;
  revoked: boolean;
  country: string | null;
  publicUrl: string;
};

type Webhook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string | null;
  lastFiredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
};

type RecentResponse = {
  items: RecentItem[];
  total: number;
  limit: number;
};

/* ───────── sample payload for the "Try it" demo button ───────── */
const SAMPLE_PAYLOAD = {
  artifact: "AEVION investor brief v3",
  type: "document",
  authors: ["AEVION Labs"],
  issuedAt: "2026-04-23T10:00:00Z",
  hashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  claims: {
    originality: "first-registration",
    jurisdiction: "KZ",
    version: 3,
  },
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

  // health + live metrics
  const [health, setHealth] = useState<Health | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recent, setRecent] = useState<RecentResponse | null>(null);

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
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [, setRateTick] = useState(0);
  const [hashingFile, setHashingFile] = useState(false);

  // webhooks
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [sdkLang, setSdkLang] = useState<"curl" | "ts" | "python">("curl");

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

  /* — tick countdown timer for rate-limit reset, only while a rate-limit
   * window is known. The 1s tick triggers re-render via setRateTick so the
   * "resets in Ns" text stays current; the actual reset value is read from
   * RateLimit-Reset response headers and stored in `rateLimit.resetAt`.
   */
  useEffect(() => {
    if (!rateLimit?.resetAt) return;
    const t = setInterval(() => setRateTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rateLimit?.resetAt]);

  /* — live stats + recent feed (refetched after every successful sign) — */
  const loadMetrics = () => {
    fetch(apiUrl("/api/qsign/v2/stats"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StatsResponse | null) => setStats(d))
      .catch(() => setStats(null));
    fetch(apiUrl("/api/qsign/v2/recent?limit=8"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RecentResponse | null) => setRecent(d))
      .catch(() => setRecent(null));
  };
  useEffect(() => {
    loadMetrics();
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

  /* — webhooks: list / create / delete —
   * The list endpoint is auth-gated; we only fetch when a token is present.
   * Create returns a one-time `secret` that we surface in a banner — once
   * the user dismisses it the secret is unrecoverable, matching the
   * server's "shown once" contract.
   */
  const loadWebhooks = async (currentToken?: string) => {
    const t = (currentToken ?? token).trim();
    if (!t) {
      setWebhooks(null);
      return;
    }
    try {
      const r = await fetch(apiUrl("/api/qsign/v2/webhooks"), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) {
        setWebhooks(null);
        return;
      }
      const d = await r.json();
      setWebhooks(d.webhooks || []);
    } catch {
      setWebhooks(null);
    }
  };

  useEffect(() => {
    if (token) loadWebhooks(token);
    else setWebhooks(null);
  }, [token]);

  const createWebhook = async () => {
    if (!token.trim()) {
      showToast("Sign in first", "error");
      return;
    }
    const url = webhookUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast("URL must start with http(s)://", "error");
      return;
    }
    setCreatingWebhook(true);
    try {
      const r = await fetch(apiUrl("/api/qsign/v2/webhooks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ url, events: ["sign", "revoke"] }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d?.error || `Create failed (${r.status})`, "error");
        return;
      }
      setNewWebhookSecret({ id: d.id, secret: d.secret });
      setWebhookUrlInput("");
      await loadWebhooks();
      showToast("Webhook created — copy the secret now", "success");
    } catch (e: any) {
      showToast("Create error: " + (e?.message || String(e)), "error");
    } finally {
      setCreatingWebhook(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!token.trim()) return;
    try {
      const r = await fetch(apiUrl(`/api/qsign/v2/webhooks/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        showToast(d?.error || `Delete failed (${r.status})`, "error");
        return;
      }
      await loadWebhooks();
      showToast("Webhook deleted", "success");
    } catch (e: any) {
      showToast("Delete error: " + (e?.message || String(e)), "error");
    }
  };

  /* — hash a file client-side and load it as a sign-ready payload —
   * Reads the entire file into memory and SHA-256s it via WebCrypto. The
   * payload becomes a JSON envelope { type, name, size, mime, sha256,
   * signedAt } that the server signs as-is — the file itself never leaves
   * the browser. Suits documents, images, audio, anything whose integrity
   * matters but whose contents are private.
   *
   * Memory cap: 50MB. Larger files would block the main thread and ESM
   * crypto can't stream digests.
   */
  const FILE_MAX_BYTES = 50 * 1024 * 1024;
  const hashFile = async (file: File) => {
    if (file.size > FILE_MAX_BYTES) {
      showToast(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB cap)`,
        "error",
      );
      return;
    }
    setHashingFile(true);
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const envelope = {
        type: "file",
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        sha256: hex,
        signedAt: new Date().toISOString(),
      };
      setPayloadText(JSON.stringify(envelope, null, 2));
      setPayloadOrigin(
        `file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      );
      showToast(`Hashed ${file.name}`, "success");
    } catch (e: any) {
      showToast(`Hash failed: ${e?.message || String(e)}`, "error");
    } finally {
      setHashingFile(false);
    }
  };

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
      // RateLimit-* headers are exposed by express-rate-limit when standardHeaders=true.
      // CORS-cross-origin reads require Access-Control-Expose-Headers on the server, so
      // when fetched same-origin (Vercel→Vercel rewrite or local dev) values arrive; on
      // cross-origin they may be null and the card simply won't render.
      const limitH = res.headers.get("RateLimit-Limit");
      const remH = res.headers.get("RateLimit-Remaining");
      const resetH = res.headers.get("RateLimit-Reset");
      if (limitH && remH) {
        const limit = Number(limitH);
        const remaining = Number(remH);
        const resetSec = resetH ? Number(resetH) : null;
        if (Number.isFinite(limit) && Number.isFinite(remaining)) {
          setRateLimit({
            limit,
            remaining,
            resetAt:
              resetSec !== null && Number.isFinite(resetSec)
                ? Date.now() + resetSec * 1000
                : null,
          });
        }
      }
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
      loadMetrics();
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
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    opacity: 0.75,
                    marginBottom: 8,
                  }}
                >
                  AEVION · Digital Signature Platform
                </div>
                <h1
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    margin: "0 0 8px",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  Tamper-evident proofs,
                  <br />
                  publicly verifiable in one link.
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    opacity: 0.88,
                    lineHeight: 1.55,
                    maxWidth: 640,
                  }}
                >
                  QSign v2 signs any JSON payload under{" "}
                  <strong>RFC 8785 canonical form</strong> with a hybrid of{" "}
                  <strong>HMAC-SHA256</strong> and <strong>Ed25519</strong>. Every signature is
                  persisted, geo-anchored, revocable, and verifiable from a shareable public
                  URL — no vendor lock-in, no trust-us.
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

        {/* ─── Live stats strip ─── */}
        {stats ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              marginBottom: 18,
            }}
          >
            <StatCard
              label="Signatures anchored"
              value={stats.signatures.total.toLocaleString("en-US")}
              accent="#0f172a"
              hint={
                stats.signatures.last24h > 0
                  ? `+${stats.signatures.last24h} in last 24h`
                  : "ready for first anchor"
              }
            />
            <StatCard
              label="Active"
              value={stats.signatures.active.toLocaleString("en-US")}
              accent="#047857"
              hint={
                stats.signatures.revoked > 0
                  ? `${stats.signatures.revoked} revoked`
                  : "none revoked"
              }
            />
            <StatCard
              label="Unique issuers"
              value={stats.issuers.unique.toLocaleString("en-US")}
              accent="#0d9488"
              hint={`${stats.geo.uniqueCountries} countries`}
            />
            <StatCard
              label="Active keys"
              value={String(
                (stats.keys["HMAC-SHA256"]?.active || 0) +
                  (stats.keys["Ed25519"]?.active || 0),
              )}
              accent="#6366f1"
              hint={`${Object.values(stats.keys).reduce(
                (a, b) => a + (b?.retired || 0),
                0,
              )} retired (verify-only)`}
            />
          </div>
        ) : null}

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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <div style={label}>Payload (JSON)</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <label
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 11,
                      fontWeight: 700,
                      color: hashingFile ? "#94a3b8" : "#6366f1",
                      cursor: hashingFile ? "default" : "pointer",
                      padding: 0,
                    }}
                  >
                    {hashingFile ? "Hashing…" : "📎 Hash a file"}
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          void hashFile(f);
                          e.target.value = "";
                        }
                      }}
                      disabled={hashingFile}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPayloadText(JSON.stringify(SAMPLE_PAYLOAD, null, 2))
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0d9488",
                      cursor: "pointer",
                      padding: 0,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    Load sample
                  </button>
                </div>
              </div>
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

            {rateLimit
              ? (() => {
                  const secsLeft =
                    rateLimit.resetAt !== null
                      ? Math.max(0, Math.round((rateLimit.resetAt - Date.now()) / 1000))
                      : null;
                  const low = rateLimit.remaining <= 5;
                  return (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: low ? "rgba(220,38,38,0.06)" : "#f1f5f9",
                        border: low
                          ? "1px solid rgba(220,38,38,0.25)"
                          : "1px solid rgba(15,23,42,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: "#64748b", fontWeight: 700 }}>
                        Sign rate limit (per IP)
                      </span>
                      <span
                        style={{
                          ...mono,
                          fontSize: 11,
                          fontWeight: 700,
                          color: low ? "#b91c1c" : "#0f172a",
                        }}
                      >
                        {rateLimit.remaining}/{rateLimit.limit} left
                        {secsLeft !== null ? ` · resets in ${secsLeft}s` : ""}
                      </span>
                    </div>
                  );
                })()
              : null}

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
                  {signed.dilithium ? (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: "rgba(99,102,241,0.06)",
                        border: "1px dashed rgba(99,102,241,0.35)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca" }}>
                          ML-DSA-65 (Dilithium-3) · {signed.dilithium.mode}
                        </div>
                        <span style={chip("rgba(99,102,241,0.18)", "#4338ca")}>
                          PQ slot reserved
                        </span>
                      </div>
                      <code
                        style={{
                          ...mono,
                          fontSize: 10,
                          wordBreak: "break-all",
                          color: "#475569",
                        }}
                      >
                        digest: {signed.dilithium.digest.slice(0, 64)}…
                      </code>
                      <div style={{ marginTop: 4, fontSize: 10, color: "#64748b" }}>
                        Real post-quantum signature lands in v2.1; current digest is a
                        deterministic SHA-512 fingerprint of canonical||kid.
                      </div>
                    </div>
                  ) : null}
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
                    onClick={() => {
                      const verifyAbs =
                        typeof window !== "undefined"
                          ? `${window.location.origin}/qsign/verify/${signed.id}`
                          : signed.publicUrl;
                      copy(verifyAbs, "Verify link");
                    }}
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
                    Copy link
                  </button>
                  <a
                    href={apiUrl(`/api/qsign/v2/${signed.id}/pdf?download=1`)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      color: "#0f172a",
                    }}
                  >
                    Download PDF
                  </a>
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
                  {verifyResult.dilithium ? (
                    <div>
                      Dilithium-3 (preview):{" "}
                      <strong
                        style={{
                          color:
                            verifyResult.dilithium.valid === null
                              ? "#64748b"
                              : verifyResult.dilithium.valid
                              ? "#4338ca"
                              : "#b91c1c",
                        }}
                      >
                        {verifyResult.dilithium.valid === null
                          ? "not checked"
                          : verifyResult.dilithium.valid
                          ? "preview-ok"
                          : "preview-mismatch"}
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

        {/* ─── Recent signatures feed ─── */}
        {recent && recent.items.length > 0 ? (
          <div style={{ marginTop: 24, ...card }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Recent anchors</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Live feed — public verification URLs, no identifying data.
                </div>
              </div>
              {stats ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    fontFamily: "monospace",
                  }}
                >
                  updated{" "}
                  {new Date(stats.asOf).toISOString().slice(11, 19)} UTC
                </span>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {recent.items.map((it) => (
                <Link
                  key={it.id}
                  href={it.publicUrl}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.05)",
                    textDecoration: "none",
                    color: "#0f172a",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: it.revoked ? "#b45309" : "#10b981",
                      flexShrink: 0,
                    }}
                  />
                  <code
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 12,
                      color: "#334155",
                    }}
                  >
                    {it.id.slice(0, 8)}…{it.id.slice(-4)}
                  </code>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontFamily: "monospace",
                    }}
                  >
                    {it.country || "—"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontFamily: "monospace",
                    }}
                  >
                    {it.createdAt
                      ? new Date(it.createdAt).toISOString().slice(0, 19).replace("T", " ")
                      : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* ─── Webhooks (auth-gated) ─── */}
        {token ? (
          <div style={{ marginTop: 24, ...card }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Webhooks</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  HTTP callbacks fired on <code>sign</code> + <code>revoke</code>{" "}
                  events for your signatures. Body is HMAC-SHA256 signed via the
                  webhook secret; receivers verify the <code>X-QSign-Signature</code> header.
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  fontFamily: "monospace",
                }}
              >
                {webhooks ? `${webhooks.length}/10 used` : "—"}
              </span>
            </div>

            {newWebhookSecret ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.4)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#92400e",
                    marginBottom: 6,
                  }}
                >
                  ⚠ Save this secret — it is shown ONCE
                </div>
                <code
                  style={{
                    ...mono,
                    fontSize: 11,
                    wordBreak: "break-all",
                    display: "block",
                    background: "#fff",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid rgba(245,158,11,0.3)",
                    color: "#0f172a",
                  }}
                >
                  {newWebhookSecret.secret}
                </code>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() =>
                      copy(newWebhookSecret.secret, "Webhook secret")
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Copy secret
                  </button>
                  <button
                    onClick={() => setNewWebhookSecret(null)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    I saved it — dismiss
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://your-app.example.com/qsign-webhook"
                style={{ ...inputStyle, ...mono, fontSize: 12, flex: 1, minWidth: 240 }}
              />
              <button
                onClick={createWebhook}
                disabled={creatingWebhook || !webhookUrlInput.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    creatingWebhook || !webhookUrlInput.trim() ? "#94a3b8" : "#6366f1",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor:
                    creatingWebhook || !webhookUrlInput.trim() ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {creatingWebhook ? "Creating…" : "Add webhook"}
              </button>
            </div>

            {webhooks === null ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</div>
            ) : webhooks.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontStyle: "italic",
                  padding: "16px 0",
                }}
              >
                No webhooks yet. Add one above to start receiving sign / revoke events.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid rgba(15,23,42,0.05)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          ...mono,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {wh.url}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        events: {wh.events.join(", ")}
                        {wh.lastFiredAt
                          ? ` · last fired ${new Date(wh.lastFiredAt).toISOString().slice(0, 19).replace("T", " ")}${wh.lastStatus ? ` (HTTP ${wh.lastStatus})` : ""}`
                          : " · never fired"}
                        {wh.lastError ? ` · err: ${wh.lastError.slice(0, 60)}` : ""}
                      </div>
                    </div>
                    <span
                      style={chip(
                        wh.active ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.18)",
                        wh.active ? "#047857" : "#475569",
                      )}
                    >
                      {wh.active ? "active" : "off"}
                    </span>
                    <button
                      onClick={() => deleteWebhook(wh.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(220,38,38,0.25)",
                        background: "#fff",
                        color: "#b91c1c",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* ─── Use the API (SDK examples) ─── */}
        <div style={{ marginTop: 24, ...card }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Use the API</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Live snippets — copy and paste. Replace{" "}
                <code style={mono}>$TOKEN</code> with your bearer.
                {signed ? (
                  <>
                    {" "}
                    Signature id <code style={mono}>{signed.id.slice(0, 8)}…</code> from
                    your latest sign is preserved.
                  </>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["curl", "ts", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSdkLang(lang)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(15,23,42,0.15)",
                    background: sdkLang === lang ? "#0f172a" : "#fff",
                    color: sdkLang === lang ? "#fff" : "#0f172a",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {lang === "curl" ? "curl" : lang === "ts" ? "TypeScript" : "Python"}
                </button>
              ))}
            </div>
          </div>
          <pre
            style={{
              ...mono,
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 14,
              borderRadius: 10,
              fontSize: 11.5,
              overflowX: "auto",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {sdkLang === "curl"
              ? buildCurlSnippet(signed)
              : sdkLang === "ts"
                ? buildTsSnippet(signed)
                : buildPythonSnippet(signed)}
          </pre>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() =>
                copy(
                  sdkLang === "curl"
                    ? buildCurlSnippet(signed)
                    : sdkLang === "ts"
                      ? buildTsSnippet(signed)
                      : buildPythonSnippet(signed),
                  "Snippet",
                )
              }
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Copy snippet
            </button>
            <a
              href={apiUrl("/api/qsign/v2/openapi.json")}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              OpenAPI 3.0 spec ↗
            </a>
            <a
              href="https://github.com/Dossymbek281078/AEVION/tree/main/aevion-globus-backend/sdk"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              SDK packages ↗
            </a>
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

/* ───────── SDK snippet builders ─────────
 * Live code samples shown in the "Use the API" card. When the user has
 * just signed a payload, the latest signature id flows into the verify
 * URL examples so partners see a real working call rather than a stub.
 */

function buildCurlSnippet(signed: SignResponse | null): string {
  const sigId = signed?.id ?? "<signature-id>";
  const hmacKid = signed?.hmac.kid ?? "qsign-hmac-v1";
  return `# 1. health
curl -s https://aevion-production-a70c.up.railway.app/api/qsign/v2/health | jq

# 2. sign (idempotent)
curl -s -X POST https://aevion-production-a70c.up.railway.app/api/qsign/v2/sign \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-2026-04-28-001" \\
  -d '{"payload":{"artifact":"invoice-001","amount":1500.00,"currency":"USD"}}' | jq

# 3. public verify (no auth)
curl -s https://aevion-production-a70c.up.railway.app/api/qsign/v2/${sigId}/public | jq

# 4. PDF stamp
curl -sL "https://aevion-production-a70c.up.railway.app/api/qsign/v2/${sigId}/pdf?download=1" \\
  -o signed-${sigId.slice(0, 8)}.pdf

# 5. recent activity
curl -s https://aevion-production-a70c.up.railway.app/api/qsign/v2/audit?limit=20 \\
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Prometheus metrics scrape
curl -s https://aevion-production-a70c.up.railway.app/api/qsign/v2/metrics`;
}

function buildTsSnippet(signed: SignResponse | null): string {
  const sigId = signed?.id ?? "<signature-id>";
  return `// npm install @aevion/qsign-client
import { QSignClient } from "@aevion/qsign-client";

const qsign = new QSignClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/qsign/v2",
  token: process.env.AEVION_TOKEN,
});

// Sign — idempotent retries return the same id
const sig = await qsign.sign(
  { artifact: "invoice-001", amount: 1500.00, currency: "USD" },
  { idempotencyKey: "order-2026-04-28-001" },
);
console.log(sig.id, sig.publicUrl);

// Verify (stateless)
const r = await qsign.verify({
  payload: { artifact: "invoice-001", amount: 1500.00, currency: "USD" },
  hmacKid: sig.hmac.kid,
  signatureHmac: sig.hmac.signature,
  ed25519Kid: sig.ed25519?.kid,
  signatureEd25519: sig.ed25519?.signature,
});
console.log("valid:", r.valid);

// DB-backed verify (includes revocation status)
const live = await qsign.verifyById("${sigId}");
console.log("revoked:", live.revoked);

// Audit log
const audit = await qsign.listAudit({ event: "sign", limit: 20 });
audit.items.forEach((e) => console.log(e.at, e.signatureId));

// Webhooks
const wh = await qsign.createWebhook("https://your-app.example.com/qsign-events");
console.log("save secret ONCE:", wh.secret);`;
}

function buildPythonSnippet(signed: SignResponse | null): string {
  const sigId = signed?.id ?? "<signature-id>";
  return `# pip install requests
import os, requests

BASE = "https://aevion-production-a70c.up.railway.app/api/qsign/v2"
TOKEN = os.environ["AEVION_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# 1. sign — Idempotency-Key makes retries safe
r = requests.post(
    f"{BASE}/sign",
    json={"payload": {"artifact": "invoice-001", "amount": 1500.0, "currency": "USD"}},
    headers={**H, "Idempotency-Key": "order-2026-04-28-001"},
)
sig = r.json()
print(sig["id"], sig["publicUrl"])

# 2. verify (stateless)
v = requests.post(f"{BASE}/verify", json={
    "payload": {"artifact": "invoice-001", "amount": 1500.0, "currency": "USD"},
    "hmacKid": sig["hmac"]["kid"],
    "signatureHmac": sig["hmac"]["signature"],
    "ed25519Kid": sig["ed25519"]["kid"],
    "signatureEd25519": sig["ed25519"]["signature"],
}).json()
print("valid:", v["valid"])

# 3. DB-backed verify
live = requests.get(f"{BASE}/verify/${sigId}").json()
print("revoked:", live["revoked"])

# 4. Webhook receiver — verify X-QSign-Signature
import hmac, hashlib
def verify_qsign_webhook(raw_body: bytes, header_sig: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header_sig.lower())`;
}

/* ───────── sub-components ───────── */

function StatCard({
  label: text,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "14px 16px",
        background: "#fff",
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {text}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>{hint}</div>
      ) : null}
    </div>
  );
}

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
