"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type CertificateData = {
  id: string;
  objectId: string;
  title: string;
  kind: string;
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

type PipelineResult = {
  success: boolean;
  message: string;
  qright: { id: string; title: string; contentHash: string; createdAt: string };
  qsign: { signature: string; algo: string };
  shield: { id: string; signature: string; publicKey: string; shards: number; threshold: number };
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

  /* ── Form state ── */
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("music");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState<string | null>(null);

  /* ── Processing animation ── */
  const [processingStep, setProcessingStep] = useState(0);

  /* ── Result ── */
  const [result, setResult] = useState<PipelineResult | null>(null);

  /* ── Registry ── */
  const [showRegistry, setShowRegistry] = useState(false);
  const [items, setItems] = useState<RightObject[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return {};
      return { Authorization: `Bearer ${raw}` };
    } catch {
      return {};
    }
  };

  /* ── Prefill from URL params ── */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("title")) setTitle(sp.get("title")!);
    if (sp.get("description")) setDescription(sp.get("description")!);
    if (sp.get("country")) setCountry(sp.get("country")!);
    if (sp.get("city")) setCity(sp.get("city")!);
  }, []);

  /* ── Prefill user from Auth ── */
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

  /* ── Submit pipeline ── */
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErr("Please fill in the title and description");
      return;
    }

    setErr(null);
    setStep("processing");
    setProcessingStep(0);

    /* Animate processing steps */
    const timers = [
      setTimeout(() => setProcessingStep(1), 600),
      setTimeout(() => setProcessingStep(2), 1400),
      setTimeout(() => setProcessingStep(3), 2200),
    ];

    try {
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
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      /* Wait for animation to finish */
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

  /* ── Load registry ── */
  const loadRegistry = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(apiUrl("/api/qright/objects"), { headers: { ...authHeaders() } });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {}
    setLoadingItems(false);
  };

  /* ── Reset form ── */
  const reset = () => {
    setStep("form");
    setTitle("");
    setDescription("");
    setKind("music");
    setResult(null);
    setProcessingStep(0);
  };

  /* ── Copy to clipboard ── */
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  const PROCESSING_STEPS = [
    { label: "Registering in QRight...", icon: "📋" },
    { label: "Signing with HMAC-SHA256...", icon: "🔏" },
    { label: "Creating Quantum Shield...", icon: "🛡️" },
    { label: "Protection complete!", icon: "✅" },
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
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>QRight · QSign · Quantum Shield — all in one click</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.6, maxWidth: 600 }}>
              Register your intellectual property, sign it cryptographically, and protect it with military-grade Quantum Shield — automatically.
            </p>
          </div>
        </div>

        {/* ── Step: FORM ── */}
        {step === "form" && (
          <>
            {/* How it works */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { n: "1", title: "Describe", desc: "Tell us about your work", color: "#0d9488" },
                { n: "2", title: "Register", desc: "SHA-256 hash in QRight", color: "#3b82f6" },
                { n: "3", title: "Sign", desc: "HMAC-SHA256 signature", color: "#8b5cf6" },
                { n: "4", title: "Shield", desc: "Ed25519 + Shamir SSS", color: "#f59e0b" },
              ].map((s) => (
                <div key={s.n} style={{ textAlign: "center", padding: "14px 8px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, marginBottom: 6 }}>{s.n}</div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{s.desc}</div>
                </div>
              ))}
            </div>

            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6, display: "block" }}>
                  What are you protecting? *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "My AI Music Track", "Logo Design v3", "Trading Algorithm"'
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Type selector */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 8, display: "block" }}>
                  Type of work
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {KIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: kind === opt.value ? "2px solid #0d9488" : "1px solid rgba(15,23,42,0.12)",
                        background: kind === opt.value ? "rgba(13,148,136,0.08)" : "#fff",
                        fontSize: 12,
                        fontWeight: kind === opt.value ? 800 : 600,
                        color: kind === opt.value ? "#0d9488" : "#475569",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s",
                      }}
                    >
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6, display: "block" }}>
                  Describe your work *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is it? What makes it unique? The more detail, the stronger the protection."
                  rows={4}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              {/* Author info (collapsible) */}
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
                <div style={{ color: "#dc2626", fontSize: 13, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
                  {err}
                </div>
              )}

              <button
                type="submit"
                style={{
                  padding: "16px 24px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(13,148,136,0.35)",
                  transition: "transform 0.15s",
                }}
              >
                🛡️ Protect My Work
              </button>
            </form>
          </>
        )}

        {/* ── Step: PROCESSING ── */}
        {step === "processing" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", marginBottom: 24 }}>Protecting your work...</div>
            <div style={{ maxWidth: 360, margin: "0 auto", display: "grid", gap: 12 }}>
              {PROCESSING_STEPS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: processingStep > i ? "rgba(16,185,129,0.08)" : processingStep === i ? "rgba(13,148,136,0.06)" : "rgba(15,23,42,0.02)",
                    border: `1px solid ${processingStep > i ? "rgba(16,185,129,0.25)" : processingStep === i ? "rgba(13,148,136,0.2)" : "rgba(15,23,42,0.06)"}`,
                    transition: "all 0.4s",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{processingStep > i ? "✅" : s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: processingStep >= i ? 700 : 500, color: processingStep > i ? "#059669" : processingStep === i ? "#0d9488" : "#94a3b8" }}>
                    {s.label}
                  </span>
                  {processingStep === i && (
                    <span style={{ marginLeft: "auto", width: 16, height: 16, border: "2px solid #0d9488", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  )}
                </div>
              ))}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Step: DONE ── */}
        {step === "done" && result && (
          <div>
            {/* Success banner */}
            <div style={{ textAlign: "center", padding: "32px 20px", marginBottom: 24, borderRadius: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(13,148,136,0.06))", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", marginBottom: 6 }}>Your Work is Protected!</div>
              <div style={{ fontSize: 14, color: "#475569" }}>{result.message}</div>
            </div>

            {/* Certificate card */}
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

                {/* Technical details */}
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
                      <button
                        onClick={() => copy(item.value, item.label)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.15)", fontSize: 12, color: "#0f766e" }}>
                  <b>3-layer protection active:</b> SHA-256 hash + HMAC-SHA256 signature + Ed25519 with Shamir&apos;s Secret Sharing ({result.shield.shards} shards, threshold {result.shield.threshold})
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <button
                onClick={reset}
                style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
              >
                🛡️ Protect Another Work
              </button>
              <Link
                href={`/quantum-shield`}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #0f172a", color: "#0f172a", fontWeight: 800, fontSize: 14, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                View Shield Dashboard →
              </Link>
              <button
                onClick={() => copy(JSON.stringify(result.certificate, null, 2), "Certificate JSON")}
                style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Export Certificate JSON
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
              {loadingItems ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading registry...</div>
              ) : items.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No records yet. Protect your first work above!</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((x) => (
                    <div key={x.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 14, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" as const }}>{x.kind}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(x.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{x.title}</div>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.1)", color: "#059669", whiteSpace: "nowrap" }}>✓ REGISTERED</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{x.description.slice(0, 120)}{x.description.length > 120 ? "..." : ""}</div>
                      <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 10, fontFamily: "monospace", color: "#64748b", wordBreak: "break-all" }}>
                        SHA-256: {x.contentHash}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}