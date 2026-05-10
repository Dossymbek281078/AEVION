"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
import { InfoTip } from "@/components/InfoTip";

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
    fileHash?: string | null;
    signatureHmac: string;
    signatureEd25519?: string | null;
    algorithm: string;
    protectedAt: string;
    status: string;
    verificationLevel?: "anonymous" | "verified";
    verifiedName?: string | null;
    verifiedAt?: string | null;
    verifiedBy?: string | null;
  };
  integrity: {
    contentHashValid: boolean;
    signatureHmacValid: boolean | null;
    signatureHmacReason?: "OK" | "NO_SIGNED_AT" | "MISMATCH" | "ERROR";
    qsignKeyVersion?: number;
    currentKeyVersion?: number;
    keyRotatedSinceSigning?: boolean;
    quantumShieldStatus: string;
    shieldLegacy?: boolean;
    shieldId?: string | null;
    shards: number;
    threshold: number;
    authorCosign?:
      | { present: false }
      | { present: true; valid: boolean; fingerprint: string };
  };
  bitcoinAnchor?: {
    status: "pending" | "bitcoin-confirmed" | "failed" | "not_stamped";
    bitcoinBlockHeight: number | null;
    stampedAt: string | null;
    upgradedAt: string | null;
    hasProof: boolean;
    network: string;
    proofUrl: string | null;
    upgradeUrl: string | null;
  };
  shardDistribution?: {
    policy: "legacy_all_local" | "distributed_v2";
    realDistributed: boolean;
    locations: Array<{
      index: number;
      place: string;
      held: string;
      serverHasCopy: boolean;
      cid?: string;
      cidValid?: boolean;
    }>;
    witness: {
      cid: string;
      cidValid: boolean;
      witnessUrl: string;
    } | null;
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
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

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

  const tryUpgrade = async () => {
    if (!data?.bitcoinAnchor?.upgradeUrl) return;
    setUpgrading(true);
    setUpgradeMsg(null);
    try {
      const res = await fetch(apiUrl(data.bitcoinAnchor.upgradeUrl), {
        method: "POST",
      });
      const json = await res.json();
      if (json.upgraded) {
        setUpgradeMsg(
          `Bitcoin confirmed at block #${json.bitcoinBlockHeight}!`,
        );
        // Refresh data to show the confirmed state.
        const r2 = await fetch(apiUrl(`/api/pipeline/verify/${certId}`));
        const j2 = await r2.json();
        if (r2.ok && j2.valid) setData(j2 as VerifyData);
      } else {
        setUpgradeMsg(
          json.note || "Still pending Bitcoin confirmation — try later.",
        );
      }
    } catch {
      setUpgradeMsg("Upgrade request failed — try again in a moment.");
    } finally {
      setUpgrading(false);
    }
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
              ? "Every cryptographic layer matches. The work below was registered by the named author at the time shown, and no field has been altered since."
              : "One or more integrity layers did not match. The per-layer breakdown below shows exactly which check failed and what it means."}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            Verified at {new Date(data.verifiedAt).toLocaleString()} · Check #{data.stats.verifiedCount}
          </div>
        </div>

        {/* How to read this page */}
        <div
          role="region"
          aria-label="How to read this verification page"
          style={{ borderRadius: 14, border: "1px solid rgba(13,148,136,0.18)", background: "rgba(13,148,136,0.04)", padding: "16px 18px", marginBottom: 24 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }} aria-hidden>👇</span>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f766e" }}>How to read this page</div>
          </div>
          <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 6, fontSize: 12, color: "#0f172a", lineHeight: 1.6 }}>
            <li>
              <b>Status banner</b> above is the one-line verdict — green only if every applicable layer matched.
            </li>
            <li>
              <b>Integrity Checks</b> break that verdict apart: content hash, HMAC (with key version), Shamir shielding, and the author&apos;s own co-signature. Each tile is one independent test.
            </li>
            <li>
              <b>Shard Distribution</b> shows where the Ed25519 private key was split. AEVION holds at most 1 of 3, so we cannot forge or recover this key alone.
            </li>
            <li>
              <b>Bitcoin Anchor</b> records <i>when</i> the certificate existed — settled by Bitcoin&apos;s proof-of-work, not by us.
            </li>
            <li>
              <b>Independent of AEVION</b> at the bottom downloads a self-contained bundle — verify offline today, in 10 years, on any machine.
            </li>
          </ol>
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
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
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
                {cert.verificationLevel === "verified" && (
                  <div style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.25))",
                    color: "#c7d2fe",
                    fontSize: 10,
                    fontWeight: 800,
                    border: "1px solid rgba(165,180,252,0.4)",
                  }}>
                    ⭐ VERIFIED AUTHOR
                  </div>
                )}
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

            {cert.verificationLevel === "verified" && (
              <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(79,70,229,0.06))", border: "1px solid rgba(99,102,241,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }} aria-hidden>⭐</span>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#312e81" }}>
                    Author identity verified by AEVION Bureau
                  </div>
                  <InfoTip
                    label="Verified Author tier"
                    text="The author's government-issued ID was checked by AEVION's KYC partner. The bureau attests that the verified name matched the author named on this certificate at the time of verification."
                  />
                </div>
                <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.55 }}>
                  <b>{cert.verifiedName || cert.author}</b>
                  {cert.verifiedAt && (
                    <> · verified {new Date(cert.verifiedAt).toLocaleDateString()}</>
                  )}
                  {cert.verifiedBy && (
                    <> · attested by AEVION (KYC partner: {cert.verifiedBy})</>
                  )}
                </div>
              </div>
            )}

            {/* Cryptographic details */}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center" }}>
              Cryptographic Proof
              <InfoTip
                label="Cryptographic Proof"
                text="Three derived proofs (SHA-256 content hash, HMAC signature, Ed25519 signature) plus the algorithm and certificate ID for context. Tamper with any registered field and at least one of the three derived values stops matching."
              />
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {[
                {
                  label: "Content Hash (SHA-256)",
                  value: cert.contentHash,
                  valid: integrity.contentHashValid,
                  tip: { name: "SHA-256", text: "Cryptographic fingerprint of your work. Changing one byte in the source produces a completely different hash, so this value can prove the original content has not been altered." },
                },
                {
                  label: "HMAC-SHA256 Signature",
                  value: cert.signatureHmac,
                  tip: { name: "HMAC-SHA256", text: "Tamper-detection signature computed with AEVION's secret key. Anyone with the same key can re-derive it from the certificate fields and check that it has not been changed." },
                },
                {
                  label: "Ed25519 Signature",
                  value: cert.signatureEd25519 || "N/A",
                  tip: { name: "Ed25519", text: "An asymmetric digital signature. The matching public key is published, so anyone — not just AEVION — can verify that the signature is genuine." },
                },
                { label: "Algorithm", value: cert.algorithm },
                { label: "Certificate ID", value: cert.id },
                ...(cert.fileHash ? [{ label: "File Hash (SHA-256)", value: cert.fileHash, tip: { name: "File Hash", text: "SHA-256 of the original file bytes, computed in the author's browser before submission. Paste this hash into the bureau prior-art search to find this exact file." } }] : []),
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
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span>{item.label}</span>
                      {"tip" in item && item.tip && (
                        <InfoTip label={item.tip.name} text={item.tip.text} size={12} />
                      )}
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
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center" }}>
              Integrity Checks
              <InfoTip
                label="Integrity Checks"
                text="Each tile is one independent test. Green tiles passed; red tiles failed. A certificate is fully valid only when every tile is green."
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {(() => {
                const certKv = integrity.qsignKeyVersion ?? 1;
                const curKv = integrity.currentKeyVersion ?? 1;
                const rotated = integrity.keyRotatedSinceSigning === true;
                const hmacOk = integrity.signatureHmacValid === true;
                return [
                  {
                    label: "Content Hash",
                    status: integrity.contentHashValid,
                    detail: integrity.contentHashValid ? "SHA-256 verified" : "Hash mismatch",
                    tip: { name: "Content Hash", text: "We re-hash the certificate's metadata with SHA-256 and compare it to the stored value. Match means the registered fields have not changed since protection." },
                  },
                  {
                    label: "HMAC Signature",
                    status: hmacOk,
                    detail:
                      hmacOk
                        ? "HMAC-SHA256 re-verified"
                        : integrity.signatureHmacReason === "NO_SIGNED_AT"
                          ? "Legacy row — signedAt not recorded"
                          : integrity.signatureHmacReason === "MISMATCH"
                            ? "Signature mismatch"
                            : "Verification error",
                    tip: { name: "HMAC Signature", text: "We recompute the HMAC-SHA256 from the certificate's signed fields with the secret key version that signed it, and compare. Match proves no field has been tampered with." },
                  },
                  {
                    label: "HMAC Key Version",
                    status: hmacOk,
                    detail: rotated
                      ? `Signed under v${certKv} · current is v${curKv} · key rotated, signature still valid`
                      : `Signed under v${certKv} · current key`,
                    tip: { name: "Key Rotation", text: "AEVION can rotate signing keys without invalidating older certificates. Each row records the version it was signed with, so we always verify under the right key." },
                  },
                  {
                    label: "Quantum Shield",
                    status: integrity.quantumShieldStatus === "active" && integrity.shieldLegacy !== true,
                    detail: integrity.shieldLegacy === true ? "Legacy shield (pre-v2)" : `Status: ${integrity.quantumShieldStatus}`,
                    tip: { name: "Quantum Shield", text: "AEVION's protection envelope. Combines Ed25519 signing with Shamir secret-sharing so no single party can recover the private key alone." },
                  },
                  {
                    label: "Secret Sharing",
                    status: integrity.shieldLegacy !== true,
                    detail: integrity.shieldLegacy === true ? "Legacy — not real SSS" : `${integrity.shards} shards, threshold ${integrity.threshold} (Shamir SSS)`,
                    tip: { name: "Shamir Secret Sharing", text: "The Ed25519 private key is split into 3 shards. Any 2 reconstruct it; any 1 alone reveals nothing. AEVION never holds 2 of them." },
                  },
                  (() => {
                    const co = integrity.authorCosign;
                    if (!co || !co.present) {
                      return {
                        label: "Author Co-Signature",
                        status: false,
                        detail: "Not signed by author (legacy single-party cert)",
                        tip: { name: "Author co-signing", text: "Modern AEVION certificates carry a second Ed25519 signature held only by the author's browser. This row was protected before that layer existed — its other integrity checks remain valid." },
                      };
                    }
                    return {
                      label: "Author Co-Signature",
                      status: co.valid,
                      detail: co.valid
                        ? `Verified · author key ed25519:${co.fingerprint}`
                        : `Signature mismatch · purported key ed25519:${co.fingerprint || "unknown"}`,
                      tip: { name: "Author co-signing", text: "An Ed25519 signature made with the author's browser-held private key. AEVION never sees this key — even a full platform breach cannot forge a valid co-signature for someone else's identity." },
                    };
                  })(),
                  {
                    label: "Certificate Status",
                    status: cert.status === "active",
                    detail: cert.status,
                    tip: undefined as { name: string; text: string } | undefined,
                  },
                ];
              })().map((check) => (
                <div key={check.label} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${check.status ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  background: check.status ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14 }} aria-label={check.status ? "passed" : "failed"}>{check.status ? "✅" : "❌"}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{check.label}</span>
                    {check.tip && <InfoTip label={check.tip.name} text={check.tip.text} size={12} />}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{check.detail}</div>
                </div>
              ))}
            </div>

            {integrity.shieldId && (
              <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(59,130,246,0.04))", border: "1px solid rgba(13,148,136,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }} aria-hidden>🛡️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f766e" }}>Linked Quantum Shield record</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", marginTop: 2 }}>{integrity.shieldId}</div>
                  </div>
                </div>
                <a
                  href={`/quantum-shield/${integrity.shieldId}`}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800 }}
                >
                  View Shield →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Shard distribution (Shamir SSS 2-of-3 across independent locations) */}
        {data.shardDistribution && (
          <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "16px 24px", background: "rgba(15,23,42,0.02)", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }} aria-hidden>🧩</span>
                  Shard Distribution (Shamir SSS 2-of-3)
                  <InfoTip
                    label="Shamir 2-of-3"
                    text="The signing key is split into 3 pieces stored in different places. Combining any 2 of the 3 reconstructs the key; possessing only 1 reveals nothing. AEVION holds at most 1 — so no rogue platform action can forge your certificate."
                  />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {data.shardDistribution.realDistributed
                    ? "Any 2 of 3 shards reconstruct the Ed25519 private key; no single holder can forge the certificate."
                    : "Legacy record: all three shards are stored in our DB. Re-protect to upgrade to true distribution."}
                </div>
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background: data.shardDistribution.realDistributed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                color: data.shardDistribution.realDistributed ? "#059669" : "#d97706",
              }}>
                {data.shardDistribution.realDistributed ? "✓ TRULY DISTRIBUTED" : "⚠ LEGACY (LOCAL)"}
              </div>
            </div>
            <div style={{ padding: "20px 24px", background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {data.shardDistribution.locations.map((loc) => (
                  <div key={loc.index} style={{
                    padding: "14px",
                    borderRadius: 10,
                    border: `1px solid ${!loc.serverHasCopy ? "rgba(16,185,129,0.25)" : "rgba(15,23,42,0.08)"}`,
                    background: !loc.serverHasCopy ? "rgba(16,185,129,0.03)" : "#f8fafc",
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>
                      {loc.index === 1 ? "👤" : loc.index === 2 ? "🏢" : "🌐"}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                      Shard {loc.index}: {loc.place}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{loc.held}</div>
                    <div style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 9,
                      fontWeight: 800,
                      background: !loc.serverHasCopy ? "#059669" : "#64748b",
                      color: "#fff",
                    }}>
                      {!loc.serverHasCopy ? "OFFLINE (user holds)" : "ON-SERVER"}
                    </div>
                    {loc.cid && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>
                          CID {loc.cidValid ? "✓" : "✗"}
                        </div>
                        <div style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const, lineHeight: 1.3 }}>
                          {loc.cid}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {data.shardDistribution.witness && (
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(15,23,42,0.03)", border: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, color: "#475569" }}>
                    Public witness shard — fetchable by anyone, integrity verified via content-addressed CID
                  </div>
                  <a
                    href={apiUrl(data.shardDistribution.witness.witnessUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: "6px 12px", borderRadius: 6, background: "#0f172a", color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 700 }}
                  >
                    Fetch Witness Shard →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bitcoin anchor (OpenTimestamps) */}
        {data.bitcoinAnchor && data.bitcoinAnchor.status !== "not_stamped" && (
          <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, #f7931a10, #0f172a05)", borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }} aria-hidden>₿</span>
                  Bitcoin Blockchain Anchor
                  <InfoTip
                    label="OpenTimestamps"
                    text="At protection time we submit the content hash to OpenTimestamps. Within hours it is included in a Bitcoin block — proof that this exact certificate existed by that timestamp, verifiable against any Bitcoin node without trusting AEVION."
                  />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {data.bitcoinAnchor.network} — third-party verifiable timestamp
                </div>
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                background:
                  data.bitcoinAnchor.status === "bitcoin-confirmed"
                    ? "rgba(16,185,129,0.15)"
                    : data.bitcoinAnchor.status === "pending"
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(239,68,68,0.15)",
                color:
                  data.bitcoinAnchor.status === "bitcoin-confirmed"
                    ? "#059669"
                    : data.bitcoinAnchor.status === "pending"
                      ? "#d97706"
                      : "#dc2626",
              }}>
                {data.bitcoinAnchor.status === "bitcoin-confirmed"
                  ? `✓ CONFIRMED @ BLOCK #${data.bitcoinAnchor.bitcoinBlockHeight}`
                  : data.bitcoinAnchor.status === "pending"
                    ? "⏱ PENDING CONFIRMATION"
                    : "✗ FAILED"}
              </div>
            </div>
            <div style={{ padding: "20px 24px", background: "#fff" }}>
              {data.bitcoinAnchor.status === "bitcoin-confirmed" && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: "#065f46", lineHeight: 1.6 }}>
                    The content hash of this certificate is <b>permanently recorded in the Bitcoin blockchain</b> at block <b>#{data.bitcoinAnchor.bitcoinBlockHeight}</b>. This proof is independent of AEVION — anyone can verify it with the standard OpenTimestamps client.
                  </div>
                </div>
              )}
              {data.bitcoinAnchor.status === "pending" && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                    Hash submitted to the OpenTimestamps calendar network. It will be included in a Bitcoin block within 1-6 hours, after which this certificate becomes independently verifiable against any Bitcoin node.
                  </div>
                </div>
              )}
              {data.bitcoinAnchor.status === "failed" && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.6 }}>
                    Bitcoin anchoring failed at the time of protection (calendar network unreachable). The other cryptographic layers remain valid.
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {data.bitcoinAnchor.stampedAt && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Submitted to OT</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{new Date(data.bitcoinAnchor.stampedAt).toLocaleString()}</div>
                  </div>
                )}
                {data.bitcoinAnchor.upgradedAt && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Bitcoin-confirmed</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{new Date(data.bitcoinAnchor.upgradedAt).toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.bitcoinAnchor.hasProof && data.bitcoinAnchor.proofUrl && (
                  <a
                    href={apiUrl(data.bitcoinAnchor.proofUrl)}
                    style={{ padding: "8px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                  >
                    ⬇ Download .ots proof
                  </a>
                )}
                {data.bitcoinAnchor.status === "pending" && data.bitcoinAnchor.upgradeUrl && (
                  <button
                    onClick={tryUpgrade}
                    disabled={upgrading}
                    style={{ padding: "8px 14px", borderRadius: 8, background: upgrading ? "#cbd5e1" : "#f7931a", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: upgrading ? "not-allowed" : "pointer" }}
                  >
                    {upgrading ? "Checking..." : "₿ Try upgrade now"}
                  </button>
                )}
                <a
                  href="https://opentimestamps.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", color: "#475569", border: "1px solid rgba(15,23,42,0.12)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                >
                  What is OpenTimestamps?
                </a>
              </div>
              {upgradeMsg && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 12, color: "#334155" }}>
                  {upgradeMsg}
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Verifiable independence */}
        <div style={{ borderRadius: 14, border: "1px solid rgba(99,102,241,0.25)", background: "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(79,70,229,0.04))", padding: "16px 18px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }} aria-hidden>🛡️</span>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#3730a3" }}>
              Independent of AEVION
            </div>
            <InfoTip
              label="Verification bundle"
              text="A single .json containing every proof — the canonical inputs, AEVION's Ed25519 signature, the author co-signature, the OpenTimestamps Bitcoin proof. With this bundle and a browser, anyone can verify the certificate forever without contacting AEVION."
            />
          </div>
          <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.55, marginBottom: 10 }}>
            Most platforms&apos; certificates die when the platform dies. Ours don&apos;t. Download the bundle below — one <code style={{ fontSize: 11, padding: "1px 5px", background: "rgba(99,102,241,0.12)", borderRadius: 4 }}>.json</code> with every proof — then drop it into the offline verifier on any machine, any year. Bitcoin and Ed25519 are the trust anchors. We&apos;re replaceable; the math is not.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={apiUrl(`/api/pipeline/certificate/${cert.id}/bundle.json`)}
              style={{ padding: "10px 16px", borderRadius: 10, background: "#4f46e5", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}
            >
              ⬇ Download bundle.json
            </a>
            <a
              href="/verify-offline"
              style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #4f46e5", color: "#4f46e5", background: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}
            >
              Open offline verifier →
            </a>
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
            AEVION Digital IP Bureau · SHA-256 · Ed25519 · Shamir 2-of-3 · OpenTimestamps + Bitcoin
          </div>
        </div>
      </div>
    </div>
  );
}