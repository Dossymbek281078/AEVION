"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Certificate = {
  id: string;
  title: string;
  kind: string;
  author: string;
  location?: string | null;
  contentHash: string;
  algorithm: string;
  protectedAt: string;
  verifiedCount: number;
  verifyUrl: string;
};

type VerifyResult = {
  certId: string;
  valid: boolean;
  contentHashValid: boolean;
  shieldStatus: string;
  verifiedAt: string;
};

const KIND_ICONS: Record<string, string> = {
  music: "🎵", code: "💻", design: "🎨", text: "📝", video: "🎬", idea: "💡", other: "📦",
};

export default function QSignPage() {
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ── Manual verify state ── */
  const [manualId, setManualId] = useState("");
  const [manualResult, setManualResult] = useState<VerifyResult | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const loadCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/pipeline/certificates"));
      if (res.ok) {
        const data = await res.json();
        setCertificates(data.certificates || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCertificates(); }, [loadCertificates]);

  /* ── Prefill from URL ── */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("certId") || sp.get("id");
    if (id) setManualId(id);
  }, []);

  const verifyCert = async (certId: string) => {
    setBusyId(certId);
    try {
      const res = await fetch(apiUrl(`/api/pipeline/verify/${certId}`));
      const data = await res.json();
      if (data.valid) {
        const result: VerifyResult = {
          certId,
          valid: true,
          contentHashValid: data.integrity?.contentHashValid ?? true,
          shieldStatus: data.integrity?.quantumShieldStatus ?? "unknown",
          verifiedAt: data.verifiedAt,
        };
        setVerifyResults((prev) => ({ ...prev, [certId]: result }));
        showToast("Signature verified — integrity confirmed!", "success");
      } else {
        setVerifyResults((prev) => ({
          ...prev,
          [certId]: { certId, valid: false, contentHashValid: false, shieldStatus: "failed", verifiedAt: new Date().toISOString() },
        }));
        showToast("Verification failed", "error");
      }
    } catch {
      showToast("Verification error — server unavailable", "error");
    } finally {
      setBusyId(null);
    }
  };

  const verifyManual = async () => {
    const id = manualId.trim();
    if (!id) { setManualError("Enter a certificate ID"); return; }
    setManualBusy(true);
    setManualError(null);
    setManualResult(null);
    try {
      const res = await fetch(apiUrl(`/api/pipeline/verify/${id}`));
      const data = await res.json();
      if (data.valid) {
        setManualResult({
          certId: id,
          valid: true,
          contentHashValid: data.integrity?.contentHashValid ?? true,
          shieldStatus: data.integrity?.quantumShieldStatus ?? "unknown",
          verifiedAt: data.verifiedAt,
        });
        showToast("Certificate verified!", "success");
      } else {
        setManualError(data.error || "Certificate not found or invalid");
        showToast("Verification failed", "error");
      }
    } catch {
      setManualError("Server unavailable");
    } finally {
      setManualBusy(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  return (
    <main>
      <ProductPageShell maxWidth={900}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b, #334155)", padding: "28px 28px 22px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔏</div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>QSign — Signature Verification</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Verify the integrity of any AEVION-protected work</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.6, maxWidth: 640 }}>
              Every work protected through AEVION receives cryptographic signatures (HMAC-SHA256 + Ed25519). Here you can verify that any certificate is authentic and the content has not been tampered with.
            </p>
          </div>
        </div>

        {/* ── Quick navigation ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>🛡️ Protect New Work</Link>
          <Link href="/bureau" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>IP Bureau</Link>
          <Link href="/quantum-shield" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Quantum Shield</Link>
        </div>

        {/* ── Manual verification ── */}
        <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20, marginBottom: 28, background: "#fff" }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Verify Any Certificate</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Enter a certificate ID to verify its authenticity and integrity</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="cert-xxxxxxxxxxxxxxxx"
              onKeyDown={(e) => e.key === "Enter" && verifyManual()}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, fontFamily: "monospace", outline: "none" }}
            />
            <button
              onClick={verifyManual}
              disabled={manualBusy}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: manualBusy ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: manualBusy ? "default" : "pointer", whiteSpace: "nowrap" }}
            >
              {manualBusy ? "Verifying..." : "🔍 Verify"}
            </button>
          </div>

          {manualError && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)", fontSize: 13, color: "#dc2626" }}>
              ❌ {manualError}
            </div>
          )}

          {manualResult && (
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#059669" }}>Certificate Verified</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Content Hash</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: manualResult.contentHashValid ? "#059669" : "#dc2626" }}>{manualResult.contentHashValid ? "✓ Valid" : "✗ Mismatch"}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Quantum Shield</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: manualResult.shieldStatus === "active" ? "#059669" : "#d97706" }}>{manualResult.shieldStatus}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Verified At</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{new Date(manualResult.verifiedAt).toLocaleTimeString()}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <Link href={`/verify/${manualResult.certId}`} style={{ padding: "6px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>View Full Certificate</Link>
                <a href={apiUrl(`/api/pipeline/certificate/${manualResult.certId}/pdf`)} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>📄 Download PDF</a>
              </div>
            </div>
          )}
        </div>

        {/* ── Your protected works ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Your Protected Works ({certificates.length})</div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading certificates...</div>
          ) : certificates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔏</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>No protected works yet</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Protect your first work to verify signatures here</div>
              <Link href="/qright" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>🛡️ Protect Your Work</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {certificates.map((cert) => {
                const vr = verifyResults[cert.id];
                return (
                  <div key={cert.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                          <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{cert.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          by {cert.author}{cert.location ? ` · ${cert.location}` : ""} · {new Date(cert.protectedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {vr ? (
                        <div style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: vr.valid ? "rgba(16,185,129,0.1)" : "rgba(220,38,38,0.1)", color: vr.valid ? "#059669" : "#dc2626" }}>
                          {vr.valid ? "✓ VERIFIED" : "✗ FAILED"}
                        </div>
                      ) : (
                        <div style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488" }}>
                          ✓ SIGNED
                        </div>
                      )}
                    </div>

                    {/* Hash */}
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>SHA-256 Content Hash</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{cert.contentHash}</div>
                      </div>
                      <button onClick={() => copy(cert.contentHash, "Hash")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}>Copy</button>
                    </div>

                    {/* Verify result details */}
                    {vr && vr.valid && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>Content Hash</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>✓ Valid</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>Quantum Shield</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{vr.shieldStatus}</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>Verified</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{new Date(vr.verifiedAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => verifyCert(cert.id)}
                        disabled={busyId === cert.id}
                        style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: busyId === cert.id ? "#94a3b8" : vr?.valid ? "#059669" : "#0f172a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: busyId === cert.id ? "default" : "pointer" }}
                      >
                        {busyId === cert.id ? "Verifying..." : vr?.valid ? "✓ Re-verify" : "🔍 Verify Signature"}
                      </button>
                      <Link href={`/verify/${cert.id}`} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0d9488", color: "#0d9488", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>View Certificate</Link>
                      <a href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>📄 PDF</a>
                      <button onClick={() => copy(cert.verifyUrl, "Verify URL")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Link</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>How Signature Verification Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { icon: "🔏", title: "HMAC-SHA256 Signing", desc: "When you protect a work, we create a unique HMAC-SHA256 signature using a server-side secret key. This signature is mathematically tied to your content — any change to the data invalidates the signature." },
              { icon: "🔍", title: "Integrity Verification", desc: "When you verify, we recompute the content hash and check it against the stored signature. If both match, the content is proven to be untampered since the moment of protection." },
              { icon: "🛡️", title: "Quantum Shield Check", desc: "Each verification also checks the status of your Quantum Shield — the Ed25519 signature and Shamir's Secret Sharing shards that provide an additional layer of cryptographic protection." },
              { icon: "📜", title: "Legal Evidence", desc: "Every verification is counted and timestamped. This creates an audit trail that strengthens the evidentiary value of your certificate under the Berne Convention and WIPO frameworks." },
            ].map((item) => (
              <div key={item.title} style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{item.title}</div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tech stack ── */}
        <div style={{ padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>Cryptographic Stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["HMAC-SHA256", "Ed25519 (RFC 8032)", "SHA-256 (NIST FIPS 180-4)", "Shamir's Secret Sharing", "Public Verification API"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}