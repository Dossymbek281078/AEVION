"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

type VerifyData = {
  valid: boolean;
  verified: boolean;
  verifiedAt: string;
  certificate: {
    id: string;
    objectId: string;
    title: string;
    kind: string;
    description: string;
    author: string;
    email?: string | null;
    location?: string | null;
    contentHash: string;
    signatureHmac: string;
    signatureEd25519?: string | null;
    algorithm: string;
    protectedAt: string;
    status: string;
  };
  integrity: {
    contentHashValid: boolean;
    quantumShieldStatus: string;
    shards: number;
    threshold: number;
  };
  legalBasis: {
    framework: string;
    type: string;
    international: Array<{ name: string; principle: string }>;
    digitalSignature: Array<{ name: string; scope: string }>;
    disclaimer: string;
  };
  stats: {
    verifiedCount: number;
    lastVerifiedAt: string;
  };
};

const KIND_LABELS: Record<string, string> = {
  music: "Music / Audio",
  code: "Code / Software",
  design: "Design / Visual",
  text: "Text / Article",
  video: "Video / Film",
  idea: "Idea / Concept",
  other: "Other",
};

export default function VerifyPage() {
  const params = useParams();
  const certId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certId) return;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/pipeline/verify/${certId}`));
        const json = await res.json();
        if (!res.ok || !json.valid) {
          setError(json.error || "Certificate not found or invalid");
          return;
        }
        setData(json as VerifyData);
      } catch {
        setError("Failed to connect to verification server");
      } finally {
        setLoading(false);
      }
    })();
  }, [certId]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Verifying certificate...</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>{certId}</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: "0 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#dc2626", marginBottom: 8 }}>Verification Failed</div>
          <div style={{ fontSize: 14, color: "#475569", marginBottom: 20 }}>{error || "Certificate not found"}</div>
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)", fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
            ID: {certId}
          </div>
          <a href="/" style={{ display: "inline-block", marginTop: 20, padding: "10px 20px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
            Go to AEVION
          </a>
        </div>
      </div>
    );
  }

  const cert = data.certificate;
  const integrity = data.integrity;
  const legal = data.legalBasis;
  const allChecksPass = integrity.contentHashValid && integrity.quantumShieldStatus === "active";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", padding: "20px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff" }}>A</div>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>AEVION</span>
          </a>
          <div style={{ fontSize: 12, color: "#64748b" }}>Digital IP Bureau — Public Verification</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Status banner */}
        <div style={{
          textAlign: "center",
          padding: "28px 20px",
          borderRadius: 16,
          marginBottom: 24,
          background: allChecksPass
            ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(13,148,136,0.06))"
            : "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))",
          border: `1px solid ${allChecksPass ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{allChecksPass ? "✅" : "⚠️"}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: allChecksPass ? "#059669" : "#d97706", marginBottom: 6 }}>
            {allChecksPass ? "Certificate Verified" : "Verification Warning"}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>
            {allChecksPass
              ? "This certificate is authentic and the protected work's integrity is confirmed."
              : "Some integrity checks did not pass. See details below."}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            Verified at {new Date(data.verifiedAt).toLocaleString()} · Check #{data.stats.verifiedCount}
          </div>
        </div>

        {/* Certificate card */}
        <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 24 }}>
          {/* Card header */}
          <div style={{ background: "#0f172a", padding: "20px 24px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  AEVION Digital IP Bureau — Protection Certificate
                </div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{cert.title}</div>
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: cert.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: cert.status === "active" ? "#10b981" : "#ef4444",
                fontSize: 12,
                fontWeight: 800,
              }}>
                {cert.status === "active" ? "✓ PROTECTED" : "⚠ " + cert.status.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: "20px 24px", background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {[
                { label: "Author", value: cert.author },
                { label: "Type", value: KIND_LABELS[cert.kind] || cert.kind },
                { label: "Protected At", value: new Date(cert.protectedAt).toLocaleString() },
                { label: "Location", value: cert.location || "Not specified" },
              ].map((f) => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{f.value}</div>
                </div>
              ))}
            </div>

            {cert.description && (
              <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{cert.description}</div>
              </div>
            )}

            {/* Cryptographic details */}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Cryptographic Proof</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Content Hash (SHA-256)", value: cert.contentHash, valid: integrity.contentHashValid },
                { label: "HMAC-SHA256 Signature", value: cert.signatureHmac },
                { label: "Ed25519 Signature", value: cert.signatureEd25519 || "N/A" },
                { label: "Algorithm", value: cert.algorithm },
                { label: "Certificate ID", value: cert.id },
              ].map((item) => (
                <div key={item.label} style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid rgba(15,23,42,0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      {item.label}
                      {"valid" in item && (
                        <span style={{ color: item.valid ? "#059669" : "#dc2626", fontSize: 10 }}>
                          {item.valid ? " ✓ valid" : " ✗ mismatch"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{item.value}</div>
                  </div>
                  <button
                    onClick={() => copy(item.value)}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>

            {/* Integrity checks */}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Integrity Checks</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Content Hash", status: integrity.contentHashValid, detail: integrity.contentHashValid ? "SHA-256 verified" : "Hash mismatch" },
                { label: "Quantum Shield", status: integrity.quantumShieldStatus === "active", detail: `Status: ${integrity.quantumShieldStatus}` },
                { label: "Secret Sharing", status: true, detail: `${integrity.shards} shards, threshold ${integrity.threshold}` },
                { label: "Certificate Status", status: cert.status === "active", detail: cert.status },
              ].map((check) => (
                <div key={check.label} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${check.status ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  background: check.status ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{check.status ? "✅" : "❌"}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{check.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{check.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legal basis */}
        <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "16px 24px", background: "rgba(15,23,42,0.02)", borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>Legal Basis</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{legal.framework} — {legal.type}</div>
          </div>
          <div style={{ padding: "20px 24px", background: "#fff" }}>
            {/* International frameworks */}
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>International Copyright Frameworks</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {legal.international.map((l, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.06)", background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0d9488" }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>{l.principle}</div>
                </div>
              ))}
            </div>

            {/* Digital signature laws */}
            {legal.digitalSignature && legal.digitalSignature.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Digital Signature Legislation</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {legal.digitalSignature.map((l, i) => (
                    <div key={i} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>{l.name}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{l.scope}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Disclaimer */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
              <b>Legal Disclaimer:</b> {legal.disclaimer}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <a href="/qright" style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #0d9488, #06b6d4)",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 14,
          }}>
            🛡️ Protect Your Own Work
          </a>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            AEVION Digital IP Bureau · Powered by SHA-256, Ed25519, and Shamir&apos;s Secret Sharing
          </div>
        </div>
      </div>
    </div>
  );
}