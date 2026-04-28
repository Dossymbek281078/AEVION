"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { InfoTip } from "@/components/InfoTip";
import { apiUrl } from "@/lib/apiBase";
import { canonicalContentHash } from "@/lib/canonicalContentHash";
import { Sparkline } from "@/components/Sparkline";
import {
  exportAuthorKeyBackup,
  getOrCreateAuthorKey,
  importAuthorKeyBackup,
  isCosignSupported,
  type AuthorKey,
  type AuthorKeyBackup,
} from "@/lib/aevionAuthorKey";

const TOUR_KEY = "aevion_qright_tour_seen_v1";
const KEY_BACKUP_KEY = "aevion_author_key_backed_up_v1";

type CertificateData = {
  id: string;
  objectId: string;
  title: string;
  kind: string;
  description?: string;
  author: string;
  email?: string | null;
  location?: string | null;
  contentHash: string;
  signatureHmac: string;
  signatureEd25519: string;
  shieldId: string;
  shards: number;
  threshold: number;
  algorithm: string;
  protectedAt: string;
  verifyUrl: string;
};

type AuthorShard = {
  shieldId: string;
  shard: {
    index: number;
    sssShare: string;
    hmac: string;
    hmacKeyVersion: number;
    location: string;
    createdAt: string;
    lastVerified: string;
  };
  warning: string;
  recoveryPaths: string[];
};

type PipelineResult = {
  success: boolean;
  message: string;
  qright: { id: string; title: string; contentHash: string; createdAt: string };
  qsign: { signature: string; algo: string };
  shield: {
    id: string;
    signature: string;
    publicKey: string;
    shards: number;
    threshold: number;
    distributionPolicy?: "legacy_all_local" | "distributed_v2";
  };
  authorShard?: AuthorShard;
  vaultShard?: { index: number; location: string; stored: boolean };
  witness?: {
    index: number;
    location: string;
    cid: string;
    witnessUrl: string;
  };
  cosign?:
    | { present: false }
    | { present: true; algo: string; authorKeyFingerprint: string };
  certificate: CertificateData;
};

type RightObject = {
  id: string;
  title: string;
  kind: string;
  description: string;
  ownerName?: string;
  ownerEmail?: string;
  contentHash: string;
  createdAt: string;
  country?: string;
  city?: string;
  revokedAt?: string | null;
  revokeReason?: string | null;
  revokeReasonCode?: string | null;
};

const REVOKE_REASON_LABELS: Record<string, string> = {
  "license-conflict": "License conflict",
  withdrawn: "Withdrawn by author",
  dispute: "Disputed authorship",
  mistake: "Registered by mistake",
  superseded: "Superseded by new version",
  other: "Other (free text)",
};

const KIND_OPTIONS = [
  { value: "music", label: "Music / Audio", icon: "🎵" },
  { value: "code", label: "Code / Software", icon: "💻" },
  { value: "design", label: "Design / Visual", icon: "🎨" },
  { value: "text", label: "Text / Article", icon: "📝" },
  { value: "video", label: "Video / Film", icon: "🎬" },
  { value: "idea", label: "Idea / Concept", icon: "💡" },
  { value: "other", label: "Other", icon: "📦" },
];

type Step = "form" | "processing" | "done";

export default function QRightPage() {
  const { showToast } = useToast();
  const TOKEN_KEY = "aevion_auth_token_v1";

  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("music");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [processingStep, setProcessingStep] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const [showRegistry, setShowRegistry] = useState(false);
  const [items, setItems] = useState<RightObject[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [registryScope, setRegistryScope] = useState<"all" | "mine">("all");
  const [registryQuery, setRegistryQuery] = useState("");
  const [hasAuth, setHasAuth] = useState(false);
  const [revokingObj, setRevokingObj] = useState<RightObject | null>(null);
  const [revokeCode, setRevokeCode] = useState<string>("withdrawn");
  const [revokeText, setRevokeText] = useState<string>("");
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, { embedFetches: number; lastFetchedAt: string | null; series: { day: string; fetches: number }[] }>>({});
  useEffect(() => {
    try {
      setHasAuth(!!localStorage.getItem(TOKEN_KEY));
    } catch {}
  }, []);

  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
    } catch {}
  }, []);
  const dismissTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
  };

  /* ── Author co-signing keypair ── */
  const [cosignSupported, setCosignSupported] = useState<boolean | null>(null);
  const [authorKey, setAuthorKey] = useState<AuthorKey | null>(null);
  const [needsBackup, setNeedsBackup] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supported = await isCosignSupported();
        if (cancelled) return;
        setCosignSupported(supported);
        if (!supported) return;

        const { key, isNew } = await getOrCreateAuthorKey();
        if (cancelled) return;
        setAuthorKey(key);

        const backedUp = (() => {
          try {
            return localStorage.getItem(KEY_BACKUP_KEY) === key.fingerprint;
          } catch {
            return false;
          }
        })();
        setNeedsBackup(isNew || !backedUp);
      } catch (e) {
        if (!cancelled) setKeyError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadKeyBackup = async () => {
    try {
      const backup: AuthorKeyBackup = await exportAuthorKeyBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-author-key-${backup.fingerprint}.json`;
      a.click();
      URL.revokeObjectURL(url);
      try {
        localStorage.setItem(KEY_BACKUP_KEY, backup.fingerprint);
      } catch {}
      setNeedsBackup(false);
      showToast("Author key backup downloaded — store it safely!", "success");
    } catch (e) {
      showToast("Backup failed: " + (e as Error).message, "error");
    }
  };

  const restoreKeyFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(String(reader.result)) as AuthorKeyBackup;
        const key = await importAuthorKeyBackup(backup);
        setAuthorKey(key);
        try {
          localStorage.setItem(KEY_BACKUP_KEY, key.fingerprint);
        } catch {}
        setNeedsBackup(false);
        showToast(`Restored key ${key.fingerprint}`, "success");
      } catch (e) {
        showToast("Restore failed: " + (e as Error).message, "error");
      }
    };
    reader.readAsText(file);
  };

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return {};
      return { Authorization: `Bearer ${raw}` };
    } catch {
      return {};
    }
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("title")) setTitle(sp.get("title")!);
    if (sp.get("description")) setDescription(sp.get("description")!);
    if (sp.get("country")) setCountry(sp.get("country")!);
    if (sp.get("city")) setCity(sp.get("city")!);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return;
      fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${raw}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.user) return;
          setOwnerName((n) => n || data.user.name);
          setOwnerEmail((e) => e || data.user.email);
        })
        .catch(() => null);
    } catch {}
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErr("Please fill in the title and description");
      return;
    }

    setErr(null);
    setStep("processing");
    setProcessingStep(0);

    const timers = [
      setTimeout(() => setProcessingStep(1), 600),
      setTimeout(() => setProcessingStep(2), 1400),
      setTimeout(() => setProcessingStep(3), 2200),
    ];

    try {
      // Pre-compute the canonical content hash and co-sign it with the
      // user's browser-held Ed25519 key BEFORE we hit the server. The
      // server will recompute the same hash and verify the signature
      // against `authorPublicKey` — any byte drift fails before any DB
      // write.
      let cosignFields: { authorPublicKey?: string; authorSignature?: string } = {};
      if (authorKey) {
        const hash = await canonicalContentHash({
          title: title.trim(),
          description: description.trim(),
          kind,
          country: country.trim() || null,
          city: city.trim() || null,
        });
        const sig = await authorKey.sign(hash);
        cosignFields = {
          authorPublicKey: authorKey.publicKeyBase64,
          authorSignature: sig,
        };
      }

      const res = await fetch(apiUrl("/api/pipeline/protect"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          kind,
          ownerName: ownerName.trim() || undefined,
          ownerEmail: ownerEmail.trim() || undefined,
          country: country.trim() || undefined,
          city: city.trim() || undefined,
          ...cosignFields,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      await new Promise((r) => setTimeout(r, 2800));
      setProcessingStep(4);
      await new Promise((r) => setTimeout(r, 500));

      setResult(data as PipelineResult);
      setStep("done");
      showToast("Your work is now protected!", "success");
    } catch (e) {
      timers.forEach(clearTimeout);
      setErr((e as Error).message);
      setStep("form");
      showToast("Protection failed: " + (e as Error).message, "error");
    }
  };

  const loadRegistry = async (
    overrideScope?: "all" | "mine",
    overrideQuery?: string
  ) => {
    const scope = overrideScope ?? registryScope;
    const query = (overrideQuery ?? registryQuery).trim();
    setLoadingItems(true);
    try {
      const path =
        query.length >= 2
          ? `/api/qright/objects/search?q=${encodeURIComponent(query)}`
          : scope === "mine"
          ? "/api/qright/objects?mine=1"
          : "/api/qright/objects";
      const res = await fetch(apiUrl(path), { headers: { ...authHeaders() } });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else if (scope === "mine" && res.status === 401) {
        showToast("Sign in to see your works", "error");
      }
    } catch {}
    setLoadingItems(false);
  };

  // Lazy-load fetch counters when scope=mine — only useful to the owner.
  useEffect(() => {
    if (registryScope !== "mine" || items.length === 0) return;
    let cancelled = false;
    const headers = authHeaders();
    if (!Object.keys(headers).length) return;
    Promise.all(
      items.map(async (it) => {
        if (stats[it.id]) return null;
        try {
          const r = await fetch(apiUrl(`/api/qright/objects/${encodeURIComponent(it.id)}/stats`), {
            headers,
          });
          if (!r.ok) return null;
          const data = await r.json();
          return [
            it.id,
            {
              embedFetches: data.embedFetches || 0,
              lastFetchedAt: data.lastFetchedAt || null,
              series: (data.series?.points || []) as { day: string; fetches: number }[],
            },
          ] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, { embedFetches: number; lastFetchedAt: string | null; series: { day: string; fetches: number }[] }> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      if (Object.keys(next).length) setStats((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, registryScope]);

  const startRevoke = (obj: RightObject) => {
    setRevokingObj(obj);
    setRevokeCode("withdrawn");
    setRevokeText("");
  };

  const submitRevoke = async () => {
    if (!revokingObj) return;
    setRevokeBusy(true);
    try {
      const res = await fetch(
        apiUrl(`/api/qright/revoke/${encodeURIComponent(revokingObj.id)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            reasonCode: revokeCode,
            reason: revokeText.trim() || undefined,
          }),
        }
      );
      if (res.ok) {
        showToast("Revoked. Embeds flip red within ~5 min.", "success");
        setRevokingObj(null);
        await loadRegistry();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(`Revoke failed: ${data.error || res.status}`, "error");
      }
    } catch (e) {
      showToast(`Revoke failed: ${(e as Error).message}`, "error");
    } finally {
      setRevokeBusy(false);
    }
  };

  const reset = () => {
    setStep("form");
    setTitle("");
    setDescription("");
    setKind("music");
    setResult(null);
    setProcessingStep(0);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  const PROCESSING_STEPS = [
    { label: "Hashing canonical content (SHA-256)...", icon: "📋" },
    { label: "Co-signing with AEVION + your browser key...", icon: "🔏" },
    { label: "Splitting key, anchoring to Bitcoin...", icon: "🛡️" },
    { label: "Forever-verifiable certificate ready", icon: "✅" },
  ];

  return (
    <main>
      <ProductPageShell maxWidth={860}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)", padding: "28px 28px 22px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🛡️</div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>Protect Your Work</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>One click. Four cryptographic layers. Forever-verifiable.</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.6, maxWidth: 600 }}>
              Register your work and walk away with a self-contained proof bundle — verifiable against Bitcoin and Ed25519 even if AEVION disappears tomorrow.
            </p>
          </div>
        </div>

        {/* ── Step: FORM ── */}
        {step === "form" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { n: "1", title: "Describe", desc: "Title and details", color: "#0d9488", tip: null },
                { n: "2", title: "Fingerprint", desc: "Tamper-evident SHA-256", color: "#3b82f6", tip: { name: "SHA-256", text: "A cryptographic fingerprint of your work. Once registered, the smallest change in the source produces a different hash — proving the original was yours." } },
                { n: "3", title: "Co-sign", desc: "AEVION + your browser key", color: "#8b5cf6", tip: { name: "Hybrid signing", text: "AEVION signs with HMAC-SHA256 (server-side) and your browser adds a second Ed25519 signature with a key only you hold. Even total platform compromise cannot forge a certificate in your name." } },
                { n: "4", title: "Anchor", desc: "Distributed key + Bitcoin", color: "#f59e0b", tip: { name: "Quantum Shield + OTS", text: "The Ed25519 private key is split into 3 Shamir shards across independent locations (any 2 reconstruct, AEVION never holds 2). The content hash is also submitted to OpenTimestamps and confirmed in a Bitcoin block — a trust anchor we don't control." } },
              ].map((s) => (
                <div key={s.n} style={{ textAlign: "center", padding: "14px 8px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, marginBottom: 6 }} aria-label={`Step ${s.n}`}>{s.n}</div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {s.title}
                    {s.tip && <InfoTip label={s.tip.name} text={s.tip.text} size={12} />}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* Author identity panel — your client-side keypair */}
            {cosignSupported === false && (
              <div role="alert" style={{ borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)", padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "#991b1b" }}>
                Your browser doesn&apos;t support Ed25519 in WebCrypto, so the author co-signature layer is disabled. The other three layers (SHA-256, HMAC, and Shamir-Ed25519) still apply — but for forge-resistance against an AEVION breach, open this page in an up-to-date Chromium or Firefox.
              </div>
            )}
            {keyError && (
              <div role="alert" style={{ borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)", padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "#991b1b" }}>
                Author key error: {keyError}
              </div>
            )}
            {authorKey && (
              <div style={{ borderRadius: 14, border: needsBackup ? "2px solid #f59e0b" : "1px solid rgba(13,148,136,0.2)", background: needsBackup ? "#fffbeb" : "rgba(13,148,136,0.04)", padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: needsBackup ? 8 : 0 }}>
                  <span style={{ fontSize: 18 }} aria-hidden>🔑</span>
                  <div style={{ fontSize: 12, fontWeight: 900, color: needsBackup ? "#92400e" : "#0f766e" }}>
                    Your author identity
                  </div>
                  <InfoTip
                    label="Author co-signing"
                    text="Your browser holds an Ed25519 keypair only known to you. Every certificate you create is also signed with this key, so even if AEVION is breached, attackers cannot forge new certificates in your name without your private key."
                  />
                  <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "monospace", color: "#475569", background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.08)" }}>
                    ed25519:{authorKey.fingerprint}
                  </span>
                </div>
                {needsBackup && (
                  <>
                    <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.55, marginBottom: 8 }}>
                      <b>Back up your key now.</b> If you lose this browser AND the backup, you cannot issue new claims under this identity. Existing certificates remain verifiable forever.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={downloadKeyBackup}
                        style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#78350f", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                      >
                        ⬇ Download key backup (.json)
                      </button>
                      <label
                        style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #92400e", background: "#fff", color: "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Restore from file
                        <input
                          type="file"
                          accept="application/json"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) restoreKeyFromFile(f);
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {showTour && (
              <div
                role="region"
                aria-label="Quick start guide"
                style={{ position: "relative", borderRadius: 14, border: "1px dashed rgba(13,148,136,0.4)", background: "rgba(13,148,136,0.05)", padding: "14px 18px 14px 16px", marginBottom: 18 }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 20 }} aria-hidden>👇</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f766e", marginBottom: 4 }}>First time? Start here.</div>
                    <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.55 }}>
                      Fill <b>title</b> and <b>description</b>, pick the type, press
                      <span style={{ display: "inline-block", margin: "0 4px", padding: "1px 8px", borderRadius: 6, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 800, fontSize: 11 }}>🛡️ Protect My Work</span>.
                      You walk away with: a public verify URL, a downloadable PDF, an Author Shard you store offline, and a Verification Bundle that works even if AEVION goes dark. Save the bundle and the shard — that&apos;s the part we cannot do for you.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissTour}
                    aria-label="Dismiss quick start guide"
                    style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 18, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6, display: "block" }}>
                  What are you protecting? *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "My AI Music Track", "Logo Design v3", "Trading Algorithm"'
                  aria-label="Title of the work you are protecting"
                  aria-required="true"
                  required
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "block" }}>Type of work</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {KIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        border: kind === opt.value ? "2px solid #0d9488" : "1px solid rgba(15,23,42,0.12)",
                        background: kind === opt.value ? "rgba(13,148,136,0.08)" : "#fff",
                        fontSize: 12, fontWeight: kind === opt.value ? 800 : 600,
                        color: kind === opt.value ? "#0d9488" : "#475569",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
                      }}
                    >
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6, display: "block" }}>Describe your work *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is it? What makes it identifiable as yours? Anything you write here becomes part of the signed certificate."
                  rows={4}
                  aria-label="Description of the work"
                  aria-required="true"
                  required
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              <details style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", padding: "12px 16px" }}>
                <summary style={{ fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer" }}>
                  Author details (optional — auto-filled if logged in)
                </summary>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Name</div>
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Your name" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Email</div>
                    <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="your@email.com" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Country</div>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Kazakhstan" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>City</div>
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Astana" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>
              </details>

              {err && (
                <div role="alert" style={{ color: "#dc2626", fontSize: 13, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>{err}</div>
              )}

              <button type="submit" aria-label="Protect my work — register, sign, and shield in one click" style={{ padding: "16px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,148,136,0.35)" }}>
                <span aria-hidden>🛡️</span> Protect My Work
              </button>
            </form>
          </>
        )}

        {/* ── Step: PROCESSING ── */}
        {step === "processing" && (
          <div role="status" aria-live="polite" style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", marginBottom: 24 }}>Protecting your work...</div>
            <div style={{ maxWidth: 360, margin: "0 auto", display: "grid", gap: 12 }}>
              {PROCESSING_STEPS.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: processingStep > i ? "rgba(16,185,129,0.08)" : processingStep === i ? "rgba(13,148,136,0.06)" : "rgba(15,23,42,0.02)", border: `1px solid ${processingStep > i ? "rgba(16,185,129,0.25)" : processingStep === i ? "rgba(13,148,136,0.2)" : "rgba(15,23,42,0.06)"}`, transition: "all 0.4s" }}>
                  <span style={{ fontSize: 20 }}>{processingStep > i ? "✅" : s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: processingStep >= i ? 700 : 500, color: processingStep > i ? "#059669" : processingStep === i ? "#0d9488" : "#94a3b8" }}>{s.label}</span>
                  {processingStep === i && <span style={{ marginLeft: "auto", width: 16, height: 16, border: "2px solid #0d9488", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />}
                </div>
              ))}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Step: DONE ── */}
        {step === "done" && result && (
          <div>
            <div style={{ textAlign: "center", padding: "32px 20px", marginBottom: 24, borderRadius: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(13,148,136,0.06))", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", marginBottom: 6 }}>Protected. Provable. Permanent.</div>
              <div style={{ fontSize: 14, color: "#475569" }}>
                {result.cosign?.present
                  ? "Four cryptographic layers active — including a co-signature only you can produce."
                  : "Three cryptographic layers active — content hash, HMAC, and Shamir-split Ed25519."}
              </div>
            </div>

            <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ background: "#0f172a", padding: "20px 24px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>AEVION Protection Certificate</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{result.certificate.title}</div>
                  </div>
                  <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 12, fontWeight: 800 }}>✓ PROTECTED</div>
                </div>
              </div>

              <div style={{ padding: "20px 24px", background: "#fff" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>AUTHOR</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{result.certificate.author}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>TYPE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{KIND_OPTIONS.find((k) => k.value === result.certificate.kind)?.label || result.certificate.kind}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>PROTECTED AT</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{new Date(result.certificate.protectedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>LOCATION</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{result.certificate.location || "Not specified"}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    { label: "Content Hash (SHA-256)", value: result.certificate.contentHash },
                    { label: "HMAC Signature", value: result.certificate.signatureHmac },
                    { label: "Ed25519 Signature", value: result.certificate.signatureEd25519 },
                    { label: "Quantum Shield ID", value: result.certificate.shieldId },
                    { label: "Certificate ID", value: result.certificate.id },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" }}>{item.value}</div>
                      </div>
                      <button onClick={() => copy(item.value, item.label)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}>Copy</button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.15)", fontSize: 12, color: "#0f766e", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                  <b>{result.cosign?.present ? "4-layer protection active:" : "3-layer protection active:"}</b>
                  <span>SHA-256 hash + HMAC-SHA256 signature + Ed25519 with Shamir&apos;s Secret Sharing ({result.shield.shards} shards, threshold {result.shield.threshold}){result.cosign?.present ? " + author co-signature" : ""}</span>
                  <InfoTip
                    label="Why these layers?"
                    text={
                      result.cosign?.present
                        ? "Each layer detects a different attack. The author co-signature is the strongest: even if AEVION is breached and all platform keys leak, attackers still cannot forge new certificates in your name without your browser-held private key."
                        : "Each layer detects a different attack: hash catches content tampering, HMAC catches certificate-field tampering, Shamir-Ed25519 makes forgery impossible without 2 of 3 distributed shards."
                    }
                  />
                </div>

                {result.cosign?.present && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }} aria-hidden>✍️</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#065f46" }}>
                        Co-signed by your author key
                        <InfoTip
                          label="Author co-signature"
                          text="This certificate carries a second Ed25519 signature made with your private key (held only in your browser, never sent to AEVION). Even if AEVION's keys leak, this layer alone proves you authored the work."
                        />
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        Author key fingerprint:&nbsp;
                        <span style={{ fontFamily: "monospace", color: "#0f172a", fontWeight: 700 }}>
                          ed25519:{result.cosign.authorKeyFingerprint}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Author shard — distributed Shamir v2 */}
            {result.authorShard && (
              <div style={{ borderRadius: 16, border: "2px solid #f59e0b", overflow: "hidden", marginBottom: 20, background: "#fffbeb" }}>
                <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#451a03" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22 }}>🔑</span>
                    Your Author Shard — Save It Now
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Shard 1 of 3 · AEVION does NOT keep a copy · Without it you depend on AEVION
                  </div>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, color: "#92400e", marginBottom: 14, lineHeight: 1.6 }}>
                    {result.authorShard.warning}
                  </div>
                  <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#78350f" }}>Any 2 of 3 reconstructs your proof:</div>
                    {result.authorShard.recoveryPaths.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#78350f", paddingLeft: 16 }}>
                        • {p}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        if (!result.authorShard) return;
                        const blob = new Blob(
                          [JSON.stringify(result.authorShard, null, 2)],
                          { type: "application/json" },
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `aevion-author-shard-${result.authorShard.shieldId}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast("Author shard downloaded — store it safely!", "success");
                      }}
                      style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: "#78350f", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
                    >
                      ⬇ Download Author Shard (.json)
                    </button>
                    <button
                      onClick={() => copy(JSON.stringify(result.authorShard, null, 2), "Author shard JSON")}
                      style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #92400e", background: "#fff", color: "#92400e", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  {result.witness && (
                    <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>Public Witness Shard (shard 3 of 3)</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>
                        CID: {result.witness.cid}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                        Content-addressed: anyone can fetch this shard and verify the bytes match the CID. Pair it with your Author Shard to recover without AEVION.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* What to do next */}
            <div
              role="region"
              aria-label="What to do next"
              style={{ borderRadius: 14, border: "1px solid rgba(13,148,136,0.2)", background: "linear-gradient(135deg, rgba(13,148,136,0.04), rgba(6,182,212,0.04))", padding: "16px 18px", marginBottom: 20 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }} aria-hidden>📋</span>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f766e" }}>What to do next</div>
              </div>
              <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 8, fontSize: 12, color: "#0f172a", lineHeight: 1.6 }}>
                <li>
                  <b>Download the Verification Bundle</b> — a single <code style={{ fontSize: 11, padding: "1px 5px", background: "#e2e8f0", borderRadius: 4 }}>.json</code> file containing every cryptographic proof. Drop it into <a href="/verify-offline" style={{ color: "#0d9488", fontWeight: 700, textDecoration: "underline" }}>/verify-offline</a> on any machine, any year, no AEVION required. <em>This is the proof that survives us.</em>
                </li>
                {result.authorShard && (
                  <li>
                    <b>Save your Author Shard</b> (orange panel above) — store it offline alongside the bundle. AEVION holds at most 1 of 3 shards; without yours, no rogue platform action can forge a recovery.
                  </li>
                )}
                <li>
                  <b>Share the verify link</b> — the public page shows every integrity check, the Bitcoin anchor status, and the legal basis.
                  <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", fontSize: 11, fontFamily: "monospace", color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ wordBreak: "break-all" as const }}>{typeof window !== "undefined" ? `${window.location.origin}/verify/${result.certificate.id}` : `/verify/${result.certificate.id}`}</span>
                    <button
                      type="button"
                      onClick={() => copy(typeof window !== "undefined" ? `${window.location.origin}/verify/${result.certificate.id}` : `/verify/${result.certificate.id}`, "Verify URL")}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}
                    >
                      Copy
                    </button>
                  </div>
                </li>
                <li>
                  <b>Print the PDF</b> for paper records — court-ready, with a QR code back to the live verify page.
                </li>
                {result.witness && (
                  <li>
                    <b>Pin the Witness Shard</b> — its CID is content-addressed, so anyone can independently fetch and verify it. Combined with your Author Shard, that&apos;s 2 of 3 — recovery without AEVION.
                  </li>
                )}
              </ol>
            </div>

            {/* Actions with PDF button */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <a
                href={apiUrl(`/api/pipeline/certificate/${result.certificate.id}/pdf`)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                📄 Download PDF Certificate
              </a>
              <a
                href={apiUrl(`/api/pipeline/certificate/${result.certificate.id}/bundle.json`)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="A single .json with every proof — verifiable offline if AEVION ever disappears"
              >
                🛡️ Download Verification Bundle
              </a>
              <Link
                href={`/verify/${result.certificate.id}`}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #0d9488", color: "#0d9488", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                ✓ Verify Certificate
              </Link>
              <Link
                href={`/bureau/upgrade/${result.certificate.id}`}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #4f46e5", color: "#4f46e5", background: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Upgrade to Verified — adds real-name attestation by AEVION Bureau"
              >
                ⭐ Upgrade to Verified ($19)
              </Link>
              <Link
                href={`/qright/badge/${result.qright.id}`}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Get an embeddable trust badge for your site"
              >
                🔖 Embed Badge
              </Link>
              <button
                onClick={reset}
                style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
              >
                🛡️ Protect Another Work
              </button>
              <Link
                href="/quantum-shield"
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                Shield Dashboard →
              </Link>
              <button
                onClick={() => copy(JSON.stringify(result.certificate, null, 2), "Certificate JSON")}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Export JSON
              </button>
            </div>
          </div>
        )}

        {/* ── Registry toggle ── */}
        <div style={{ marginTop: 32, marginBottom: 40 }}>
          <button
            onClick={() => { setShowRegistry(!showRegistry); if (!showRegistry && items.length === 0) loadRegistry(); }}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>{showRegistry ? "▼" : "▶"}</span> View QRight Registry ({items.length || "..."})
          </button>

          {showRegistry && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input
                  type="search"
                  placeholder="Search by title (≥ 2 chars)…"
                  value={registryQuery}
                  onChange={(e) => {
                    setRegistryQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadRegistry(registryScope, registryQuery);
                  }}
                  onBlur={() => loadRegistry(registryScope, registryQuery)}
                  style={{
                    flex: "1 1 240px",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.15)",
                    fontSize: 13,
                    color: "#0f172a",
                    background: "#fff",
                  }}
                />
                {hasAuth && (
                  <div style={{ display: "flex", gap: 4, padding: 3, background: "#f1f5f9", borderRadius: 8 }}>
                    {(["all", "mine"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setRegistryScope(s);
                          setRegistryQuery("");
                          loadRegistry(s, "");
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "none",
                          background: registryScope === s ? "#0f172a" : "transparent",
                          color: registryScope === s ? "#fff" : "#475569",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {s === "mine" ? "Mine" : "All"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {loadingItems ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading registry...</div>
              ) : items.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                  {registryQuery.trim().length >= 2
                    ? `No matches for "${registryQuery.trim()}".`
                    : registryScope === "mine"
                    ? "You have no protected works yet."
                    : "No records yet. Protect your first work above!"}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((x) => {
                    const isRevoked = !!x.revokedAt;
                    const showRevokeBtn = registryScope === "mine" && !isRevoked;
                    return (
                    <div key={x.id} style={{ border: `1px solid ${isRevoked ? "rgba(220,38,38,0.25)" : "rgba(15,23,42,0.08)"}`, borderRadius: 12, padding: 14, background: isRevoked ? "rgba(254,242,242,0.5)" : "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" as const }}>{x.kind}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(x.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{x.title}</div>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: isRevoked ? "rgba(220,38,38,0.1)" : "rgba(16,185,129,0.1)", color: isRevoked ? "#dc2626" : "#059669", whiteSpace: "nowrap" }}>
                          {isRevoked ? "✕ REVOKED" : "✓ REGISTERED"}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{x.description.slice(0, 120)}{x.description.length > 120 ? "..." : ""}</div>
                      {isRevoked && (x.revokeReasonCode || x.revokeReason) && (
                        <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "rgba(220,38,38,0.06)", fontSize: 11, color: "#7f1d1d" }}>
                          {x.revokeReasonCode && (
                            <strong style={{ marginRight: 6 }}>{REVOKE_REASON_LABELS[x.revokeReasonCode] || x.revokeReasonCode}:</strong>
                          )}
                          {x.revokeReason || (x.revokeReasonCode ? "no further detail" : "")}
                        </div>
                      )}
                      <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 10, fontFamily: "monospace", color: "#64748b", wordBreak: "break-all" }}>
                        SHA-256: {x.contentHash}
                      </div>
                      {registryScope === "mine" && stats[x.id] && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <span>👁 {stats[x.id].embedFetches.toLocaleString()} fetches</span>
                          {stats[x.id].series.length > 0 && (
                            <Sparkline points={stats[x.id].series} width={140} height={24} />
                          )}
                          {stats[x.id].lastFetchedAt && (
                            <span style={{ color: "#94a3b8" }}>· last {new Date(stats[x.id].lastFetchedAt!).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={apiUrl(`/api/qright/badge/${x.id}.svg`)}
                          alt={`AEVION QRight badge — ${x.title}`}
                          height={22}
                          style={{ display: "block" }}
                        />
                        <Link
                          href={`/qright/object/${x.id}`}
                          style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 6 }}
                        >
                          Public page →
                        </Link>
                        <Link
                          href={`/qright/badge/${x.id}`}
                          style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textDecoration: "none", padding: "4px 10px", border: "1px solid rgba(13,148,136,0.3)", borderRadius: 6 }}
                        >
                          Get embed code →
                        </Link>
                        {showRevokeBtn && (
                          <button
                            onClick={() => startRevoke(x)}
                            style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "transparent", padding: "4px 10px", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 6, cursor: "pointer" }}
                            title="Mark as revoked — embeds and badges flip red"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </ProductPageShell>

      {revokingObj && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevokingObj(null);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Revoke registration
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>
              <strong>{revokingObj.title}</strong>
              <br />
              This is public — embeds and badges flip red. The record stays for transparency.
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Reason
            </label>
            <select
              value={revokeCode}
              onChange={(e) => setRevokeCode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, color: "#0f172a", background: "#fff", marginBottom: 12 }}
            >
              {Object.entries(REVOKE_REASON_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Optional details (public, ≤ 500 chars)
            </label>
            <textarea
              value={revokeText}
              onChange={(e) => setRevokeText(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Visible on the public revocation banner."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, color: "#0f172a", background: "#fff", marginBottom: 16, resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRevokingObj(null)}
                disabled={revokeBusy}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: revokeBusy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitRevoke}
                disabled={revokeBusy}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 13, cursor: revokeBusy ? "not-allowed" : "pointer", opacity: revokeBusy ? 0.7 : 1 }}
              >
                {revokeBusy ? "Revoking…" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}