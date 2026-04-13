"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type ArtifactType = "music" | "movie" | "code" | "web";
type RecentArtifact = { id: string; submissionTitle?: string; artifactType?: string; voteCount?: number; voteAverage?: number | null; createdAt?: string };
type PlanetStats = { eligibleParticipants: number; distinctVotersAllTime: number; submissions: number; certifiedArtifactVersions: number };

const TYPE_OPTIONS: { value: ArtifactType; label: string; icon: string }[] = [
  { value: "music", label: "Music / Audio", icon: "🎵" },
  { value: "movie", label: "Film / Video", icon: "🎬" },
  { value: "code", label: "Code / Software", icon: "💻" },
  { value: "web", label: "Web / App", icon: "🌐" },
];

export default function PlanetPage() {
  const { showToast } = useToast();
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<"submit" | "recent" | "howItWorks">("recent");

  /* Stats */
  const [stats, setStats] = useState<PlanetStats | null>(null);
  const [recent, setRecent] = useState<RecentArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  /* Submit form */
  const [artifactType, setArtifactType] = useState<ArtifactType>("music");
  const [title, setTitle] = useState("");
  const [mediaFingerprint, setMediaFingerprint] = useState("");
  const [mediaArtist, setMediaArtist] = useState("");
  const [codeContent, setCodeContent] = useState('export const hello = "AEVION";\n');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { try { setToken(localStorage.getItem(TOKEN_KEY) || ""); } catch {} }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch(apiUrl("/api/planet/stats")).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(apiUrl("/api/planet/artifacts/recent?limit=10")).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      ]);
      if (statsRes) setStats(statsRes);
      setRecent(recentRes.items || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!token) { showToast("Please sign in first", "error"); return; }
    if (!title.trim()) { showToast("Enter a title", "error"); return; }
    setBusy(true); setResult(null);
    try {
      const body: any = {
        artifactType,
        title: title.trim(),
        productKey: artifactType === "music" ? "aevion_award_music_v1" : artifactType === "movie" ? "aevion_award_film_v1" : "planet_prod_v1_code",
        tier: "standard",
        declaredLicense: "MIT",
        generationParams: { seed: 1, mvp: true },
      };

      if (artifactType === "music" || artifactType === "movie") {
        body.mediaFingerprint = mediaFingerprint.trim() || crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        if (mediaArtist.trim()) body.mediaDescriptor = { artist: mediaArtist.trim() };
      } else {
        body.codeFiles = [{ path: "src/index.ts", content: codeContent }];
      }

      const res = await fetch(apiUrl("/api/planet/submissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult(data);
      showToast(`Submission ${data.status} — ${data.certificate ? "Certificate issued!" : "Review needed"}`, data.status === "passed" ? "success" : "error");
      loadData();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setBusy(false); }
  };

  const statusColor = (s: string) => s === "passed" ? "#059669" : s === "flagged" ? "#d97706" : "#dc2626";
  const statusBg = (s: string) => s === "passed" ? "rgba(16,185,129,0.1)" : s === "flagged" ? "rgba(245,158,11,0.1)" : "rgba(220,38,38,0.1)";

  return (
    <main>
      <ProductPageShell maxWidth={920}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #0f766e 100%)", padding: "28px 28px 22px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🌍</div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Planet — Compliance & Certification</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Submit work for compliance review, earn certificates, and receive community votes</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.6, maxWidth: 640 }}>
              Planet runs automated validators: integrity check, license compliance, plagiarism detection, risk scanning. Passed submissions earn a signed certificate and join community voting.
            </p>
          </div>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Submissions", value: stats.submissions, color: "#0d9488" },
              { label: "Certified", value: stats.certifiedArtifactVersions, color: "#059669" },
              { label: "Participants", value: stats.eligibleParticipants, color: "#3b82f6" },
              { label: "Voters", value: stats.distinctVotersAllTime, color: "#8b5cf6" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>🛡️ Protect Work (QRight)</Link>
          <Link href="/bureau" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>IP Bureau</Link>
          <Link href="/awards" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(124,58,237,0.3)", color: "#4c1d95", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>🏆 Awards</Link>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {([
            { t: "recent" as const, label: `Recent Artifacts (${recent.length})`, icon: "📋" },
            { t: "submit" as const, label: "Submit New", icon: "🚀" },
            { t: "howItWorks" as const, label: "How It Works", icon: "📖" },
          ]).map((item) => (
            <button key={item.t} onClick={() => setTab(item.t)} style={{
              padding: "9px 16px", borderRadius: 10,
              border: tab === item.t ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.15)",
              background: tab === item.t ? "#0f172a" : "transparent",
              color: tab === item.t ? "#fff" : "#0f172a",
              fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        {/* ══ RECENT TAB ══ */}
        {tab === "recent" && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading artifacts...</div>
            ) : recent.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>No certified artifacts yet</div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Be the first to submit!</div>
                <button onClick={() => setTab("submit")} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>🚀 Submit Your Work</button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recent.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                    <span style={{ fontSize: 20 }}>{TYPE_OPTIONS.find(t => t.value === a.artifactType)?.icon || "📦"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{a.submissionTitle || "Untitled"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{a.artifactType} · {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}</div>
                    </div>
                    {a.voteCount != null && a.voteCount > 0 && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#f59e0b" }}>{a.voteAverage != null ? Number(a.voteAverage).toFixed(1) : "—"} ★</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{a.voteCount} votes</div>
                      </div>
                    )}
                    <Link href={`/planet/artifact/${a.id}`} style={{ padding: "6px 12px", borderRadius: 8, background: "#0f766e", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>View</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ SUBMIT TAB ══ */}
        {tab === "submit" && (
          <div style={{ maxWidth: 560 }}>
            {!token && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 4 }}>Sign in required</div>
                <div style={{ fontSize: 12, color: "#78716c" }}>You need an AEVION account to submit work for compliance review.</div>
                <Link href="/auth" style={{ display: "inline-block", marginTop: 8, padding: "8px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>Sign In →</Link>
              </div>
            )}

            <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 24, background: "#fff" }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 16 }}>Submit for Compliance Review</div>

              {/* Type selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Artifact Type</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TYPE_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setArtifactType(opt.value)} style={{
                      padding: "8px 14px", borderRadius: 10,
                      border: artifactType === opt.value ? "2px solid #0f766e" : "1px solid rgba(15,23,42,0.12)",
                      background: artifactType === opt.value ? "rgba(15,118,110,0.08)" : "#fff",
                      fontSize: 12, fontWeight: artifactType === opt.value ? 800 : 600,
                      color: artifactType === opt.value ? "#0f766e" : "#475569",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name of your work" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Media fields */}
              {(artifactType === "music" || artifactType === "movie") && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Artist / Creator</label>
                    <input value={mediaArtist} onChange={(e) => setMediaArtist(e.target.value)} placeholder="Artist name (optional)" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Media Fingerprint</label>
                    <input value={mediaFingerprint} onChange={(e) => setMediaFingerprint(e.target.value)} placeholder="Auto-generated if empty" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Unique identifier for your media. Leave empty for auto-generation.</div>
                  </div>
                </>
              )}

              {/* Code fields */}
              {(artifactType === "code" || artifactType === "web") && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6, display: "block" }}>Source Code</label>
                  <textarea value={codeContent} onChange={(e) => setCodeContent(e.target.value)} rows={6} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
                </div>
              )}

              <button onClick={handleSubmit} disabled={busy || !token} style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: busy || !token ? "#94a3b8" : "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", fontWeight: 900, fontSize: 15, cursor: busy || !token ? "default" : "pointer",
              }}>
                {busy ? "Running validators..." : "🚀 Submit for Review"}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div style={{ marginTop: 20, borderRadius: 16, border: `1px solid ${statusColor(result.status)}30`, background: statusBg(result.status), padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>{result.status === "passed" ? "✅" : result.status === "flagged" ? "⚠️" : "❌"}</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: statusColor(result.status) }}>{result.status.toUpperCase()}</span>
                </div>

                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.8)", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Evidence Root</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" }}>{result.evidenceRoot}</div>
                  </div>
                </div>

                {/* Validator summary */}
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Validators ({result.validators?.length || 0})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
                  {(result.validators || []).map((v: any) => (
                    <div key={v.validatorId} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${statusColor(v.status)}25`, background: statusBg(v.status) }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "#0f172a" }}>{v.validatorId.replace(/_/g, " ")}</div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: statusColor(v.status), marginTop: 2 }}>{v.status}</div>
                    </div>
                  ))}
                </div>

                {result.certificate && (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#059669", marginBottom: 6 }}>🎉 Certificate Issued!</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" }}>ID: {result.certificate.certificateId}</div>
                    <Link href={`/planet/artifact/${result.artifactVersionId}`} style={{ display: "inline-block", marginTop: 8, padding: "8px 16px", borderRadius: 8, background: "#0f766e", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>View Artifact & Vote →</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ HOW IT WORKS TAB ══ */}
        {tab === "howItWorks" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {[
                { icon: "📋", title: "1. Submit Your Work", desc: "Upload music, film, code, or web app. Provide a title and basic metadata. Planet automatically runs compliance validators." },
                { icon: "🔍", title: "2. Automated Validation", desc: "6 validators check: integrity binding, license compliance, risk/safety scan, plagiarism detection, style conformance, and CI verification." },
                { icon: "📜", title: "3. Certificate Issued", desc: "If all validators pass, Planet issues a signed certificate with HMAC-SHA256 signature, evidence root, and policy manifest hash." },
                { icon: "🗳️", title: "4. Community Voting", desc: "Certified artifacts join public voting. Community members rate from 1-5 stars. Votes are Merkle-tree anchored for transparency." },
              ].map((item) => (
                <div key={item.title} style={{ padding: "18px 20px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 24 }}>{item.icon}</span>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { title: "Integrity Binding", desc: "Verifies input hash and generation params are consistent" },
                { title: "License Compliance", desc: "Checks declared license against allowed/disallowed list" },
                { title: "Risk & Safety Scan", desc: "Detects secrets, eval() calls, and dangerous patterns" },
                { title: "Plagiarism Detection", desc: "Jaccard block similarity against recent submissions" },
                { title: "Style Conformance", desc: "Validates metadata and declared standards" },
                { title: "CI Verification", desc: "Static integrity and structure verification" },
              ].map((v) => (
                <div key={v.title} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.06)", background: "#fff" }}>
                  <div style={{ fontWeight: 800, fontSize: 11, color: "#0f766e", marginBottom: 4 }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{v.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.15)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#0f766e", marginBottom: 6 }}>Merkle Tree Voting</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                Every vote is hashed into a leaf node. Votes are sorted and assembled into a Merkle tree. The root hash is signed with HMAC-SHA256 and stored as a snapshot. Any voter can request a cryptographic proof that their vote is included, without revealing other voters&apos; identities (they use pseudonymous code symbols).
              </div>
            </div>
          </div>
        )}

        {/* ── Tech footer ── */}
        <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>Planet Technology</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["6 Automated Validators", "HMAC-SHA256 Certificates", "Merkle Tree Voting", "Plagiarism Detection", "Code Symbol Anonymity", "Evidence Root"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}