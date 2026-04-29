"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  verificationLevel?: "anonymous" | "verified";
  verifiedName?: string | null;
  verifiedAt?: string | null;
};

const KIND_ICONS: Record<string, string> = {
  music: "🎵", code: "💻", design: "🎨", text: "📝", video: "🎬", idea: "💡", other: "📦",
};

const KIND_LABELS: Record<string, string> = {
  music: "Music / Audio", code: "Code / Software", design: "Design / Visual",
  text: "Text / Article", video: "Video / Film", idea: "Idea / Concept", other: "Other",
};

const LEGAL_FRAMEWORKS = [
  { name: "Berne Convention", desc: "Automatic copyright protection in 181 member states — no registration required", scope: "International", color: "#0d9488" },
  { name: "WIPO Copyright Treaty", desc: "Extends protection to digital works: software, databases, digital content", scope: "International", color: "#3b82f6" },
  { name: "TRIPS Agreement (WTO)", desc: "Minimum IP protection standards across 164 WTO member states", scope: "164 countries", color: "#8b5cf6" },
  { name: "eIDAS Regulation", desc: "Electronic signatures have legal effect equivalent to handwritten", scope: "European Union", color: "#0ea5e9" },
  { name: "ESIGN Act", desc: "Electronic signatures carry same legal standing as handwritten", scope: "United States", color: "#6366f1" },
  { name: "KZ Digital Signature Law", desc: "Electronic digital signatures are legally equivalent to handwritten", scope: "Kazakhstan", color: "#f59e0b" },
];

type DashboardData = {
  certificates: Array<{
    id: string;
    title: string;
    kind: string;
    contentHash: string;
    protectedAt: string;
    authorVerificationLevel?: "anonymous" | "verified";
    authorVerifiedAt?: string | null;
    authorVerifiedName?: string | null;
  }>;
  verifications: Array<{
    id: string;
    kycStatus: string;
    paymentStatus: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  pricing: { verifiedTierCents: number; currency: string };
};

const TOKEN_KEY = "aevion_auth_token_v1";

export default function BureauPage() {
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalVerifications: 0 });

  const [authed, setAuthed] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl("/api/pipeline/certificates"));
        if (res.ok) {
          const data = await res.json();
          const certs = data.certificates || [];
          setCertificates(certs);
          const totalVerifications = certs.reduce((sum: number, c: Certificate) => sum + (c.verifiedCount || 0), 0);
          setStats({ total: certs.length, totalVerifications });
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  // Personal dashboard — only fetch if authed.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(TOKEN_KEY);
    } catch {}
    if (!raw) return;
    setAuthed(true);
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/bureau/dashboard"), {
          headers: { Authorization: `Bearer ${raw}` },
        });
        if (r.ok) setDashboard((await r.json()) as DashboardData);
      } catch {}
    })();
  }, []);

  const myIdentity = (() => {
    if (!dashboard) return null;
    const completed = dashboard.verifications.find(
      (v) => v.kycStatus === "approved" && v.paymentStatus === "paid",
    );
    if (!completed) return null;
    const verifiedCerts = dashboard.certificates.filter(
      (c) => c.authorVerificationLevel === "verified",
    );
    const verifiedName = verifiedCerts[0]?.authorVerifiedName || null;
    const verifiedAt = verifiedCerts[0]?.authorVerifiedAt || completed.completedAt;
    return { verifiedName, verifiedAt, certCount: verifiedCerts.length };
  })();

  const inFlightUpgrade = (() => {
    if (!dashboard) return null;
    return dashboard.verifications.find(
      (v) => v.kycStatus !== "approved" || v.paymentStatus !== "paid",
    );
  })();

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  return (
    <main>
      <ProductPageShell maxWidth={920}>
        <Wave1Nav />

        {/* ── Hero Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)", padding: "32px 28px 28px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>⚖️</div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>AEVION Digital IP Bureau</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Cryptographic Proof of Authorship & Prior Art</p>
              </div>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.8, lineHeight: 1.6, maxWidth: 640 }}>
              The world&apos;s first fully digital patent bureau. Register, sign, and certify your intellectual property with military-grade cryptography — backed by international copyright law.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/qright" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                🛡️ Protect Your Work
              </Link>
              <Link href="/quantum-shield" style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                Quantum Shield Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* ── My Identity (authed users only) ── */}
        {authed && (myIdentity || inFlightUpgrade || (dashboard && dashboard.certificates.length > 0)) && (
          <div style={{ marginBottom: 22, borderRadius: 16, border: "1px solid rgba(99,102,241,0.25)", background: "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(79,70,229,0.04))", padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#312e81", marginBottom: 8 }}>
              My Bureau identity
            </div>
            {myIdentity ? (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                    ⭐ {myIdentity.verifiedName || "Verified"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                    Identity verified by AEVION Bureau
                    {myIdentity.verifiedAt && (
                      <> · {new Date(myIdentity.verifiedAt).toLocaleDateString()}</>
                    )}
                    {myIdentity.certCount > 0 && (
                      <> · attesting <b>{myIdentity.certCount}</b> certificate{myIdentity.certCount === 1 ? "" : "s"}</>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/qright" style={{ padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                    Protect another work
                  </Link>
                </div>
              </div>
            ) : inFlightUpgrade ? (
              <div>
                <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.6 }}>
                  You have an upgrade in progress — KYC <b>{inFlightUpgrade.kycStatus}</b>, payment <b>{inFlightUpgrade.paymentStatus}</b>. Continue from where you left off:
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  Pick the certificate you started upgrading from the registry below — the <em>Upgrade to Verified</em> button there resumes the same flow.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.6, marginBottom: 8 }}>
                  Anonymous certificates are fully cryptographically protected. Upgrade any one of yours to <b>Verified</b> ({dashboard ? `$${(dashboard.pricing.verifiedTierCents / 100).toFixed(2)}` : "$19"}) and the bureau will attest your real-name authorship — useful evidence in court.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { value: stats.total, label: "Certificates Issued", color: "#0d9488" },
            { value: stats.totalVerifications, label: "Total Verifications", color: "#3b82f6" },
            { value: LEGAL_FRAMEWORKS.length, label: "Legal Frameworks", color: "#8b5cf6" },
            { value: "3-Layer", label: "Cryptographic Protection", color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── How It Works ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>How AEVION IP Bureau Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { n: "1", title: "Register", desc: "Describe your work — we create a SHA-256 content hash", icon: "📋", color: "#0d9488" },
              { n: "2", title: "Sign", desc: "HMAC-SHA256 cryptographic signature proves integrity", icon: "🔏", color: "#3b82f6" },
              { n: "3", title: "Shield", desc: "Ed25519 + Shamir's Secret Sharing for quantum-grade protection", icon: "🛡️", color: "#8b5cf6" },
              { n: "4", title: "Certify", desc: "IP Certificate with legal basis — publicly verifiable", icon: "📜", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.n} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{s.n}</div>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Service Tiers ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Service Tiers</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
            Anonymous certificates are free and cryptographically complete. Higher tiers add identity attestation and (soon) notary co-signing — useful when an IP claim needs strong author identification in court.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              {
                name: "Free / Anonymous",
                price: "$0",
                blurb: "Full Qright stack: SHA-256 hash, HMAC, Ed25519, Shamir 2-of-3, OpenTimestamps Bitcoin anchor, browser-held author co-signature, offline verification bundle.",
                badge: "✓ active",
                badgeColor: "#059669",
                cta: { label: "Protect work", href: "/qright" },
              },
              {
                name: "Verified",
                price: "$19 / cert",
                blurb: "Author identity verified by KYC partner (passport / national ID). Bureau attests real-name authorship and stamps cert with the verification fingerprint.",
                badge: "▲ available now",
                badgeColor: "#4f46e5",
                cta: { label: "Upgrade a cert", href: "/bureau" },
              },
              {
                name: "Notarized",
                price: "From $89 / cert",
                blurb: "Licensed notary in KZ co-signs the certificate, producing an apostille-ready document admissible in EAEU courts. Filed-tier upgrade leads to full Kazpatent / WIPO PCT submission.",
                badge: "soon",
                badgeColor: "#94a3b8",
                cta: null as { label: string; href: string } | null,
              },
            ].map((tier) => (
              <div key={tier.name} style={{ padding: "16px 16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{tier.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: tier.badgeColor }}>{tier.badge}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{tier.price}</div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.55, flex: 1 }}>{tier.blurb}</div>
                {tier.cta && (
                  <Link href={tier.cta.href} style={{ marginTop: 6, padding: "8px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12, textAlign: "center" as const }}>
                    {tier.cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Certificate Registry ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Certificate Registry ({certificates.length})</div>
            <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>+ New Certificate</Link>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading certificates...</div>
          ) : certificates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>No certificates yet</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Protect your first work to see it here</div>
              <Link href="/qright" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>🛡️ Protect Your Work</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {certificates.map((cert) => (
                <div key={cert.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" as const }}>{KIND_LABELS[cert.kind] || cert.kind}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(cert.protectedAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>{cert.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>by {cert.author}{cert.location ? ` · ${cert.location}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                      {cert.verificationLevel === "verified" ? (
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(13,148,136,0.15))", color: "#065f46", whiteSpace: "nowrap" as const, border: "1px solid rgba(16,185,129,0.3)" }}>
                          ✓ VERIFIED AUTHOR
                        </span>
                      ) : (
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.1)", color: "#059669", whiteSpace: "nowrap" as const }}>✓ CERTIFIED</span>
                      )}
                      {cert.verifiedCount > 0 && <span style={{ fontSize: 10, color: "#94a3b8" }}>Verified {cert.verifiedCount}x</span>}
                    </div>
                  </div>

                  <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>SHA-256 Content Hash</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{cert.contentHash}</div>
                    </div>
                    <button onClick={() => copy(cert.contentHash, "Hash")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}>Copy</button>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link href={`/verify/${cert.id}`} style={{ padding: "7px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Verify</Link>
                    <a
                      href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "7px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      📄 PDF
                    </a>
                    {cert.verificationLevel !== "verified" && (
                      <Link
                        href={`/bureau/upgrade/${cert.id}`}
                        style={{ padding: "7px 14px", borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        ⭐ Upgrade to Verified
                      </Link>
                    )}
                    <button onClick={() => copy(cert.verifyUrl, "Verify URL")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Link</button>
                    <button onClick={() => copy(cert.id, "Certificate ID")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy ID</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Legal Framework ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Legal Framework</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
            AEVION IP Bureau operates under established international copyright and digital signature laws. Our certificates serve as cryptographic proof of prior art — admissible evidence in IP disputes worldwide.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {LEGAL_FRAMEWORKS.map((l) => (
              <div key={l.name} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{l.name}</div>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 6 }}>{l.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: l.color }}>{l.scope}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>Legal Disclaimer</div>
          <div style={{ fontSize: 11, color: "#78716c", lineHeight: 1.6 }}>
            Certificates issued by AEVION Digital IP Bureau constitute cryptographic proof of existence and authorship at the recorded time. They do not constitute a patent, trademark, or government-issued copyright registration. They serve as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.
          </div>
        </div>

        {/* ── Technology Stack ── */}
        <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 10 }}>Technology Stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["SHA-256 (NIST FIPS 180-4)", "HMAC-SHA256", "Ed25519 (RFC 8032)", "Shamir's Secret Sharing", "Threshold 2-of-3", "PostgreSQL", "Public Verification API"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}