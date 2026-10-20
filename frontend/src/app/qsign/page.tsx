"use client";

import Link from "next/link";
import { useQsignT } from "./i18n";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { WaitlistIfMissing } from "@/components/FooterWaitlist";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import ModulePricingChip from "@/components/ModulePricingChip";
import { PageTracking } from "@/components/PageTracking";
import { apiUrl } from "@/lib/apiBase";
import { ldWallet, svWallet, recordPlay } from "../aev/aevToken";

// AEV connector — Proof-of-Play engine A: успешные signing/verify действия mint'ят
// AEV в общий wallet. Возвращает количество сminted AEV или 0 если cap/off-mode.
function mintAevQSign(action: "qsign_sign" | "qsign_verify"): number {
  try {
    const w = ldWallet();
    if (!w.modes.play) return 0;
    const before = w.balance;
    const next = recordPlay(w, action, "qsign");
    if (next === w) return 0;
    svWallet(next);
    return next.balance - before;
  } catch { return 0; }
}

const TOKEN_KEY = "aevion_auth_token_v1";
/*
 * 🔴 19.10.2026: витрина «Проверить реальную подпись» ведёт на ЗАКРЕПЛЁННУЮ
 * демо-подпись AEVION, а не на recent.items[0]. Замер на проде 19.10: первая
 * запись ленты была ОТОЗВАННОЙ пробой, а после одного прогона пути гостя — моей
 * пробой с payload {"probe":…}; каждый прогон менял то, что видит гость.
 * Демо подписана учёткой demo-qsign@aevion.app (payload — настоящий текст о
 * назначении подписи, без слов probe/test), не отозвана; из ленты и счётчиков
 * она исключена правилом бэка (lib/qsignV2/probes), прямая ссылка живая.
 * Пустая константа = витрины нет: обещать пробу и привести в 404 хуже.
 */
const QSIGN_DEMO_SIGNATURE_ID = "8c8cbfc9-59d1-4998-be25-863776ac1558";

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
  /**
   * Бэкенд возвращает ДВА режима, а здесь стоял литерал "preview" — то есть
   * сайт объявлял, что другого не бывает. Пока ключ подписи не задан, это
   * незаметно; в день, когда его зададут, тип начнёт врать о живом ответе.
   */
  mode: "preview" | "real";
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


// Busy-ярлыки — словарём (класс «busy быстрее доводчика», назначение 07.09,
// рецепт GEN_UI.busy*). Страница англоязычная — здесь зеркальный случай:
// РУССКИЙ посетитель видел английские busy-подписи те секунды, пока идёт
// операция. Idle-подписи не трогаем — стабильный текст кроет доводчик.
/* Словарь страницы — ./i18n.ts (ru/en/kk). Прежний QS_BUSY (семь подписей «занято»)
   вошёл туда ключами busy.*. */

/** Кнопка действия в герое: одна на гостя (вход) и на вошедшего (якорь на форму). */
const heroCta: CSSProperties = {
  display: "inline-block",
  marginTop: 14,
  padding: "11px 20px",
  background: "#10b981",
  color: "#042f2e",
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 14,
  textDecoration: "none",
};

/** Отказ сети (fetch бросил до ответа) — человеку нужен текст про связь, а не "Failed to fetch". */
function isNetworkError(e: unknown): boolean {
  const m = String((e as { message?: string } | null)?.message || e || "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed");
}

export default function QSignPage() {
  const t = useQsignT();
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
        setPayloadOrigin(t("deeplink.origin"));
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
      showToast(t("toast.signInFirst"), "error");
      return;
    }
    const url = webhookUrlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast(t("toast.urlHttp"), "error");
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
        showToast(d?.error || t("toast.createFailed", { status: r.status }), "error");
        return;
      }
      setNewWebhookSecret({ id: d.id, secret: d.secret });
      setWebhookUrlInput("");
      await loadWebhooks();
      showToast(t("toast.webhookCreated"), "success");
    } catch (e: any) {
      showToast(t("toast.createError", { msg: e?.message || String(e) }), "error");
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
        showToast(d?.error || t("toast.deleteFailed", { status: r.status }), "error");
        return;
      }
      await loadWebhooks();
      showToast(t("toast.webhookDeleted"), "success");
    } catch (e: any) {
      showToast(t("toast.deleteError", { msg: e?.message || String(e) }), "error");
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
        t("toast.fileTooLarge", { mb: (file.size / 1024 / 1024).toFixed(1) }),
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
      showToast(t("toast.hashed", { name: file.name }), "success");
    } catch (e: any) {
      showToast(t("toast.hashFailed", { msg: e?.message || String(e) }), "error");
    } finally {
      setHashingFile(false);
    }
  };

  const requestGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("denied");
      showToast(t("toast.geoUnsupported"), "error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("idle");
        showToast(t("toast.gpsAttached"), "success");
      },
      () => {
        setGps(null);
        setGpsStatus("denied");
        showToast(t("toast.gpsDenied"), "error");
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
      showToast(t("toast.copied", { what }), "success");
    } catch {
      showToast(t("toast.copyFailed"), "error");
    }
  };

  /* — sign — */
  const sign = async () => {
    if (!token.trim()) {
      showToast(t("toast.signInFirst"), "error");
      return;
    }
    if (parseError) {
      showToast(t("toast.fixJson"), "error");
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
        showToast(data?.error || t("toast.signFailed", { status: res.status }), "error");
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
      showToast(t("toast.signed", { id: sr.id.slice(0, 8) }), "success");
    } catch (e: any) {
      showToast(isNetworkError(e) ? t("toast.network") : t("toast.signError", { msg: e?.message || String(e) }), "error");
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
        showToast(data?.error || t("toast.verifyFailed", { status: res.status }), "error");
        return;
      }
      setVerifyResult(data as VerifyResponse);
      showToast(data.valid ? t("toast.sigValid") : t("toast.sigInvalid"), data.valid ? "success" : "error");
    } catch (e: any) {
      showToast(isNetworkError(e) ? t("toast.verifyNetwork") : t("toast.verifyError", { msg: e?.message || String(e) }), "error");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main>
      {/* Замер посещения И запоминание канала: без него метка `?c=` на этой
          странице не доживала до кассы (разбор — в src/app/multichat-engine/page.tsx). */}
      <PageTracking page="qsign" />
      <ProductPageShell maxWidth={1080}>
        <Wave1Nav />
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <ModulePricingChip moduleId="qsign" theme="dark" />
        </div>
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
                  {t("hero.kicker")}
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
                  {t("hero.title1")}
                  <br />
                  {t("hero.title2")}
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
                  {t("hero.lead")}
                </p>
                {/* 20.10.2026: действие гостя на ПЕРВОМ экране. До этого кнопка подписи
                    лежала в 2–4 экранах ниже и была disabled без подсказки (замер Продукта
                    19.10: 390×844 — y=1964, 1463×724 — y=761). Гость → вход с возвратом сюда,
                    вошедший → якорь на форму подписи. */}
                {token ? (
                  <a href="#qsign-sign" data-qsign-cta="user" style={heroCta}>
                    {t("hero.ctaUser")}
                  </a>
                ) : (
                  <Link href="/auth?next=/qsign" data-qsign-cta="guest" style={heroCta}>
                    {t("hero.ctaGuest")}
                  </Link>
                )}
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
                  <span style={chip("rgba(239,68,68,0.18)", "#fecaca")}>{t("hero.offline")}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Первая минута гостя: проверить НАСТОЯЩУЮ подпись, без входа ───
         *
         * ЗАЧЕМ. Замер 28.09.2026 по четырём модулям: у QSkyway, QRight и Биржи
         * гость за минуту делает что-то настоящее, а у QSign — ничего. Главное
         * действие «подписать» закрыто входом (requireAuth), и человек, пришедший
         * со страницы цен, где модуль стоит $24, уходит, не увидев продукта.
         *
         * Открытая дверь была всё это время: проверка подписи не требует входа
         * (ручка v2/verify отвечает гостю), а у каждой подписи есть публичная
         * страница `/qsign/verify/<id>` — она у гостя открывается и показывает
         * VALID, проверено на проде. Не хватало ровно одного: с этой страницы на
         * неё ничто не вело. Лента настоящих подписей есть ниже по странице, но
         * до неё надо доскроллить и догадаться, что это проба.
         *
         * Поэтому блок берёт ПЕРВУЮ запись из уже загруженной ленты (нового
         * запроса не делает) и даёт одну кнопку. Ничего не обещаем сверх того,
         * что человек увидит: подпись чужая и настоящая, проверка публичная.
         */}
        {QSIGN_DEMO_SIGNATURE_ID ? (
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              borderRadius: 14,
              padding: "16px 18px",
              marginBottom: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#065f46", marginBottom: 4 }}>
                {t("demo.title")}
              </div>
              <div style={{ fontSize: 13, color: "#047857", lineHeight: 1.5 }}>
                {t("demo.body")}
              </div>
            </div>
            <a
              href={`/qsign/verify/${QSIGN_DEMO_SIGNATURE_ID}`}
              style={{
                padding: "10px 18px",
                background: "#059669",
                color: "#fff",
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 13.5,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {t("demo.cta")}
            </a>
          </div>
        ) : null}

        {/* ─── Live stats strip ───
         * 🔴 19.10.2026: при нуле подписей полоса НЕ рисуется. После фильтра проб на
         * бэке (lib/qsignV2/probes) настоящих подписей в базе 0 из 54 — полоса с
         * «0 подписей · 0 издателей · 0 стран» на первом экране говорила бы гостю
         * «тут никого нет». Ноль — правда, но не витрина; числа появятся сами с
         * первой настоящей подписью. Старый бэк (без фильтра) даёт total > 0 —
         * полоса видна как прежде, совместимо в любом порядке выкаток. */}
        {stats && stats.signatures.total > 0 ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              marginBottom: 18,
            }}
          >
            <StatCard
              label={t("stats.anchored")}
              value={stats.signatures.total.toLocaleString("en-US")}
              accent="#0f172a"
              hint={
                stats.signatures.last24h > 0
                  ? t("stats.last24h", { n: stats.signatures.last24h })
                  : t("stats.ready")
              }
            />
            <StatCard
              label={t("stats.active")}
              value={stats.signatures.active.toLocaleString("en-US")}
              accent="#047857"
              hint={
                stats.signatures.revoked > 0
                  ? t("stats.revoked", { n: stats.signatures.revoked })
                  : t("stats.noneRevoked")
              }
            />
            <StatCard
              label={t("stats.issuers")}
              value={stats.issuers.unique.toLocaleString("en-US")}
              accent="#0d9488"
              hint={t("stats.countries", { n: stats.geo.uniqueCountries })}
            />
            <StatCard
              label={t("stats.keys")}
              value={String(
                (stats.keys["HMAC-SHA256"]?.active || 0) +
                  (stats.keys["Ed25519"]?.active || 0),
              )}
              accent="#6366f1"
              hint={t("stats.retired", {
                n: Object.values(stats.keys).reduce((a, b) => a + (b?.retired || 0), 0),
              })}
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
            {t("deeplink.from", { origin: payloadOrigin })}
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
            {t("nav.keys")}
          </Link>
        </div>

        {/* ─── Auth row ─── */}
        <div style={{ ...card, marginBottom: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{t("auth.label")}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type={showToken ? "text" : "password"}
                aria-label={t("auth.label")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("auth.placeholder")}
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
              {showToken ? t("auth.hide") : t("auth.show")}
            </button>
            {!token ? (
              <Link
                href="/auth?next=/qsign"
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
                {t("auth.signIn")}
              </Link>
            ) : (
              <span style={chip("rgba(16,185,129,0.12)", "#047857")}>{t("auth.loaded")}</span>
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
          <div style={card} id="qsign-sign">
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>{t("sign.title")}</div>

            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <div style={label}>{t("sign.payload")}</div>
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
                    {hashingFile ? t("busy.hash") : t("sign.hashFile")}
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
                      className="aevion-file-input"
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
                    {t("sign.loadSample")}
                  </button>
                </div>
              </div>
              <textarea
                aria-label={t("sign.payloadAria")}
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={8}
                style={{ ...inputStyle, ...mono, resize: "vertical" }}
              />
              {parseError ? (
                <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                  {t("sign.jsonError", { msg: parseError })}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                  {t("sign.jsonOk")}
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
                <div style={label}>{t("sign.canonical")}</div>
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
                  {showCanonical ? t("sign.hideCanonical") : t("sign.showCanonical")}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ ...mono, flex: 1, wordBreak: "break-all", fontSize: 11 }}>
                  {payloadHash || "—"}
                </code>
                {payloadHash ? (
                  <button
                    onClick={() => copy(payloadHash, t("what.hash"))}
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
                    {t("sign.copy")}
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
                  {t("sign.drift")}
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{t("geo.title")}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {gps
                    ? t("geo.gps", { lat: gps.lat.toFixed(4), lng: gps.lng.toFixed(4) })
                    : gpsStatus === "denied"
                    ? t("geo.denied")
                    : t("geo.optin")}
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
                  {t("geo.clear")}
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
                  {gpsStatus === "loading" ? t("busy.gps") : t("geo.attach")}
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
              {signing ? t("busy.sign") : t("sign.button")}
            </button>

            {rateLimit ? <RateLimitBadge rateLimit={rateLimit} /> : null}

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
                  <span style={chip("rgba(16,185,129,0.12)", "#047857")}>{t("signed.chip")}</span>
                  <code style={{ ...mono, fontSize: 11 }}>{signed.id}</code>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <SigRow
                    label={`HMAC · ${signed.hmac.kid}`}
                    value={signed.hmac.signature}
                    onCopy={() => copy(signed.hmac.signature, t("what.hmacSig"))}
                  />
                  <SigRow
                    label={`Ed25519 · ${signed.ed25519.kid}`}
                    value={signed.ed25519.signature}
                    onCopy={() => copy(signed.ed25519.signature, t("what.edSig"))}
                  />
                  <SigRow
                    label={t("signed.pubkey")}
                    value={signed.ed25519.publicKey}
                    onCopy={() => copy(signed.ed25519.publicKey, t("what.pubkey"))}
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
                          {t("signed.pqReserved")}
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
                        {t("signed.pqNote")}
                      </div>
                    </div>
                  ) : null}
                  {signed.geo ? (
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      geo: {signed.geo.source}
                      {signed.geo.country ? ` · ${signed.geo.country}` : ""}
                      {signed.geo.city ? ` · ${signed.geo.city}` : ""}
                      {/* `!= null` — переживает и null, и отсутствие поля;
                          см. разбор в verify/[id]/page.tsx */}
                      {signed.geo.lat != null && signed.geo.lng != null
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
                    {t("signed.openPublic")}
                  </Link>
                  <button
                    onClick={() => {
                      const verifyAbs =
                        typeof window !== "undefined"
                          ? `${window.location.origin}/qsign/verify/${signed.id}`
                          : signed.publicUrl;
                      copy(verifyAbs, t("what.verifyLink"));
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
                    {t("signed.copyLink")}
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
                    {t("signed.pdf")}
                  </a>
                  <button
                    onClick={() => copy(JSON.stringify(signed, null, 2), t("what.fullResponse"))}
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
                    {t("signed.copyJson")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* ═══ RIGHT: Verify (stateless) ═══ */}
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>{t("verify.title")}</div>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {t("verify.lead")}
            </p>

            <div style={{ marginBottom: 10 }}>
              <div style={label}>{t("sign.payload")}</div>
              <textarea
                aria-label={t("sign.payload")}
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
              <div style={label}>{t("verify.hmacKid")}</div>
              <input
                aria-label={t("verify.hmacKidAria")}
                value={verifyHmacKid}
                onChange={(e) => setVerifyHmacKid(e.target.value)}
                placeholder={t("verify.kidPlaceholder")}
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>{t("verify.hmacSig")}</div>
              <input
                aria-label={t("verify.hmacSigAria")}
                value={verifyHmacSig}
                onChange={(e) => setVerifyHmacSig(e.target.value)}
                placeholder={t("verify.sigPlaceholder")}
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>{t("verify.edKid")}</div>
              <input
                aria-label={t("verify.edKidAria")}
                value={verifyEdKid}
                onChange={(e) => setVerifyEdKid(e.target.value)}
                placeholder={t("verify.optional")}
                style={{ ...inputStyle, ...mono, fontSize: 11 }}
              />
              <div style={label}>{t("verify.edSig")}</div>
              <input
                aria-label={t("verify.edSigAria")}
                value={verifyEdSig}
                onChange={(e) => setVerifyEdSig(e.target.value)}
                placeholder={t("verify.edSigPlaceholder")}
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
              {verifying ? t("busy.verify") : t("verify.button")}
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
                    <span style={chip("rgba(16,185,129,0.15)", "#047857")}>{t("verify.valid")}</span>
                  ) : (
                    <span style={chip("rgba(239,68,68,0.15)", "#b91c1c")}>{t("verify.invalid")}</span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <div>
                    HMAC ({verifyResult.hmac.kid}):{" "}
                    <strong
                      style={{ color: verifyResult.hmac.valid ? "#047857" : "#b91c1c" }}
                    >
                      {verifyResult.hmac.valid ? t("verify.ok") : t("verify.bad")}
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
                          ? t("verify.notChecked")
                          : verifyResult.ed25519.valid
                          ? t("verify.ok")
                          : t("verify.bad")}
                      </strong>
                    </div>
                  ) : null}
                  {verifyResult.dilithium ? (
                    <div>
                      Dilithium-3 ({verifyResult.dilithium.mode}):{" "}
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
                          ? t("verify.notChecked")
                          : verifyResult.dilithium.valid
                          ? `${verifyResult.dilithium.mode}-ok`
                          : `${verifyResult.dilithium.mode}-mismatch`}
                      </strong>
                    </div>
                  ) : null}
                  <div style={{ ...mono, color: "#64748b", fontSize: 11 }}>
                    {t("verify.hash", { h: verifyResult.payloadHash })}
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
                <div style={{ fontWeight: 900, fontSize: 15 }}>{t("recent.title")}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {t("recent.lead")}
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
                  {t("recent.updated", { t: new Date(stats.asOf).toISOString().slice(11, 19) })}
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
                <div style={{ fontWeight: 900, fontSize: 15 }}>{t("webhooks.title")}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {t("webhooks.lead")}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  fontFamily: "monospace",
                }}
              >
                {webhooks ? t("webhooks.used", { n: webhooks.length }) : "—"}
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
                  {t("webhooks.saveSecret")}
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
                      copy(newWebhookSecret.secret, t("what.webhookSecret"))
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
                    {t("webhooks.copySecret")}
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
                    {t("webhooks.dismiss")}
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                aria-label={t("webhooks.urlAria")}
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
                {creatingWebhook ? t("busy.webhook") : t("webhooks.add")}
              </button>
            </div>

            {webhooks === null ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("webhooks.loading")}</div>
            ) : webhooks.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontStyle: "italic",
                  padding: "16px 0",
                }}
              >
                {t("webhooks.none")}
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
                        {t("webhooks.events", { list: wh.events.join(", ") })}
                        {wh.lastFiredAt
                          ? t("webhooks.lastFired", { t: new Date(wh.lastFiredAt).toISOString().slice(0, 19).replace("T", " ") }) + (wh.lastStatus ? ` (HTTP ${wh.lastStatus})` : "")
                          : t("webhooks.neverFired")}
                        {wh.lastError ? ` · err: ${wh.lastError.slice(0, 60)}` : ""}
                      </div>
                    </div>
                    <span
                      style={chip(
                        wh.active ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.18)",
                        wh.active ? "#047857" : "#475569",
                      )}
                    >
                      {wh.active ? t("webhooks.active") : t("webhooks.off")}
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
                      {t("webhooks.delete")}
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
              <div style={{ fontWeight: 900, fontSize: 15 }}>{t("api.title")}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {t("api.leadA")}{" "}
                <code style={mono}>$TOKEN</code> {t("api.leadB")}
                {signed ? (
                  <>
                    {" "}
                    {t("api.preservedA")} <code style={mono}>{signed.id.slice(0, 8)}…</code>{" "}
                    {t("api.preservedB")}
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
                  t("what.snippet"),
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
              {t("api.copySnippet")}
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
              {t("api.openapi")}
            </a>
            {/* Вела на GitHub, который отдаёт 404, пока аккаунт приостановлен.
                Уводим на собственную живую страницу /sdk («SDK for AEVION Hub»)
                — она работает и отвечает на тот же вопрос. Возвращать внешнюю
                ссылку после переезда НЕ обязательно: своя страница лучше. */}
            <Link
              href="/sdk"
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
              {t("api.sdk")}
            </Link>
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
            {t("how.title")}
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
            <li>{t("how.1")}</li>
            <li>{t("how.2")}</li>
            <li>{t("how.3")}</li>
            <li>{t("how.4")}</li>
            <li>{t("how.5")}</li>
          </ol>
        </div>

        {/* Приём адреса. Общего подвала у /qsign нет: маршрут в APP_PREFIXES
            (ClientProviders), и замер 20.09.2026 показал на странице НОЛЬ полей
            почты — человек, которому рано подписываться, уходил бесследно.
            Блок сам не нарисуется, если поле на странице появится. */}
        <div style={{ maxWidth: 560, margin: "32px 0 0" }}>
          <WaitlistIfMissing
            source="qsign-page"
            title={t("waitlist.title")}
            description={t("waitlist.description")}
            buttonLabel={t("waitlist.button")}
            doneText={t("waitlist.done")}
          />
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
curl -s https://api.aevion.app/api/qsign/v2/health | jq

# 2. sign (idempotent)
curl -s -X POST https://api.aevion.app/api/qsign/v2/sign \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-2026-04-28-001" \\
  -d '{"payload":{"artifact":"invoice-001","amount":1500.00,"currency":"USD"}}' | jq

# 3. public verify (no auth)
curl -s https://api.aevion.app/api/qsign/v2/${sigId}/public | jq

# 4. PDF stamp
curl -sL "https://api.aevion.app/api/qsign/v2/${sigId}/pdf?download=1" \\
  -o signed-${sigId.slice(0, 8)}.pdf

# 5. recent activity
curl -s https://api.aevion.app/api/qsign/v2/audit?limit=20 \\
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Prometheus metrics scrape
curl -s https://api.aevion.app/api/qsign/v2/metrics`;
}

function buildTsSnippet(signed: SignResponse | null): string {
  const sigId = signed?.id ?? "<signature-id>";
  return `// No client SDK yet — call /api/qsign/v2 directly. WebCrypto fetch
// works in Node 18+, Deno, browsers, and edge runtimes.
const BASE = "https://api.aevion.app/api/qsign/v2";
const H = {
  Authorization: \`Bearer \${process.env.AEVION_TOKEN}\`,
  "Content-Type": "application/json",
};

// 1. Sign — Idempotency-Key makes retries safe (same id returned)
const sig = await fetch(\`\${BASE}/sign\`, {
  method: "POST",
  headers: { ...H, "Idempotency-Key": "order-2026-04-28-001" },
  body: JSON.stringify({ payload: { artifact: "invoice-001", amount: 1500.00, currency: "USD" } }),
}).then(r => r.json());
console.log(sig.id, sig.publicUrl);

// 2. Verify (stateless — HMAC + optional Ed25519)
const v = await fetch(\`\${BASE}/verify\`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({
    payload: { artifact: "invoice-001", amount: 1500.00, currency: "USD" },
    hmacKid: sig.hmac.kid,
    signatureHmac: sig.hmac.signature,
    ed25519Kid: sig.ed25519?.kid,
    signatureEd25519: sig.ed25519?.signature,
  }),
}).then(r => r.json());
console.log("valid:", v.valid);

// 3. DB-backed verify (includes revocation status)
const live = await fetch(\`\${BASE}/verify/${sigId}\`, { headers: H }).then(r => r.json());
console.log("revoked:", live.revoked);

// 4. Audit log
const audit = await fetch(\`\${BASE}/audit?event=sign&limit=20\`, { headers: H }).then(r => r.json());
audit.items.forEach((e) => console.log(e.at, e.signatureId));

// 5. Webhooks
const wh = await fetch(\`\${BASE}/webhooks\`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ url: "https://your-app.example.com/qsign-events" }),
}).then(r => r.json());
console.log("save secret ONCE:", wh.secret);`;
}

function buildPythonSnippet(signed: SignResponse | null): string {
  const sigId = signed?.id ?? "<signature-id>";
  return `# pip install requests
import os, requests

BASE = "https://api.aevion.app/api/qsign/v2"
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

// Rate-limit countdown badge. Owns its own 1s ticker locally (only while
// a reset time is known) so the "resets in Ns" refresh stays scoped to
// this small component instead of re-rendering the whole page (same
// setState-per-tick bug class fixed in CyberChess #721/#740/#746,
// QTrade #765, aev/page.tsx, and coach/page.tsx).
function RateLimitBadge({ rateLimit }: { rateLimit: RateLimitInfo }) {
  const t = useQsignT();
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!rateLimit.resetAt) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rateLimit.resetAt]);

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
        border: low ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(15,23,42,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11,
      }}
    >
      <span style={{ color: "#64748b", fontWeight: 700 }}>{t("rate.title")}</span>
      <span
        style={{
          ...mono,
          fontSize: 11,
          fontWeight: 700,
          color: low ? "#b91c1c" : "#0f172a",
        }}
      >
        {t("rate.left", { rem: rateLimit.remaining, limit: rateLimit.limit })}
        {secsLeft !== null ? t("rate.resets", { s: secsLeft }) : ""}
      </span>
    </div>
  );
}

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
  const t = useQsignT();
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
        {t("sign.copy")}
      </button>
    </div>
  );
}
