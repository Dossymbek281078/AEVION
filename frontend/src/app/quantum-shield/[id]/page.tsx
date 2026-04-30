"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PipelineSteps } from "@/components/PipelineSteps";
import { useToast } from "@/components/ToastProvider";
import { apiUrl } from "@/lib/apiBase";

type PublicView = {
  id: string;
  objectId?: string | null;
  objectTitle?: string | null;
  algorithm: string;
  threshold: number;
  totalShards: number;
  publicKey?: string | null;
  signature?: string | null;
  status: string;
  legacy?: boolean;
  hmacKeyVersion?: number;
  verifiedCount?: number;
  lastVerifiedAt?: string | null;
  createdAt: string;
};

export default function QuantumShieldPublicPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { showToast } = useToast();
  const [data, setData] = useState<PublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/quantum-shield/${encodeURIComponent(id)}/public`));
        if (!res.ok) throw new Error("HTTP " + res.status);
        const d = (await res.json()) as PublicView;
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied", "success");
    } catch { showToast("Copy failed", "error"); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" };
  const valueStyle: React.CSSProperties = { fontSize: 12, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" };

  return (
    <main>
      <ProductPageShell maxWidth={780}>
        <Wave1Nav />
        <PipelineSteps current="qshield" />

        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20, background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 30%, #0d2847 60%, #0c1a3a 100%)", padding: "28px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(13,148,136,0.4), rgba(59,130,246,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>&#x1F6E1;</div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700, letterSpacing: "0.08em" }}>QUANTUM SHIELD &mdash; PUBLIC VERIFY</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{data?.objectTitle || "Shield Record"}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "monospace" }}>{id}</div>
        </div>

        {loading && <div style={{ textAlign: "center" as const, padding: 40, color: "#94a3b8" }}>Loading…</div>}

        {error && (
          <div style={{ padding: 20, borderRadius: 14, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)", color: "#991b1b" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Shield not found</div>
            <div style={{ fontSize: 13, color: "#7f1d1d" }}>The record <code>{id}</code> does not exist or has been revoked.</div>
            <div style={{ fontSize: 12, marginTop: 8, color: "#991b1b" }}>{error}</div>
            <Link href="/quantum-shield" style={{ display: "inline-block", marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>&#8592; Back to dashboard</Link>
          </div>
        )}

        {data && (
          <div>
            <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: data.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: data.status === "active" ? "#059669" : "#dc2626", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                    {data.status === "active" ? "● Active" : "○ " + data.status}
                  </span>
                  {data.legacy && <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: "rgba(245,158,11,0.15)", color: "#92400e", letterSpacing: "0.05em" }}>LEGACY</span>}
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "rgba(13,148,136,0.1)", color: "#0d9488" }}>{data.threshold}/{data.totalShards} threshold</span>
                </div>
                <button onClick={copyLink} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "transparent", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#0f172a" }}>Copy Link</button>
              </div>

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={labelStyle}>Algorithm</div>
                  <div style={{ ...valueStyle, fontFamily: "inherit", fontWeight: 700 }}>{data.algorithm}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={labelStyle}>Created</div>
                  <div style={{ ...valueStyle, fontFamily: "inherit", fontWeight: 700 }}>{new Date(data.createdAt).toLocaleString()}</div>
                </div>
                {data.objectId && (
                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <div style={labelStyle}>Object ID</div>
                    <div style={valueStyle}>{data.objectId}</div>
                  </div>
                )}
                <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <div style={labelStyle}>HMAC Key Version</div>
                  <div style={{ ...valueStyle, fontFamily: "inherit" }}>v{data.hmacKeyVersion ?? 1}</div>
                </div>
                {data.verifiedCount !== undefined && (
                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <div style={labelStyle}>Successful Reconstructions</div>
                    <div style={{ ...valueStyle, fontFamily: "inherit", fontWeight: 700, color: "#0d9488" }}>{data.verifiedCount}</div>
                  </div>
                )}
                {data.lastVerifiedAt && (
                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <div style={labelStyle}>Last Verified</div>
                    <div style={{ ...valueStyle, fontFamily: "inherit" }}>{new Date(data.lastVerifiedAt).toLocaleString()}</div>
                  </div>
                )}
              </div>

              {data.publicKey && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.04)" }}>
                  <div style={labelStyle}>Ed25519 Public Key (SPKI hex)</div>
                  <div style={{ ...valueStyle, color: "#0f766e" }}>{data.publicKey}</div>
                </div>
              )}

              {data.signature && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: "1px solid rgba(15,23,42,0.06)", background: "#f8fafc" }}>
                  <div style={labelStyle}>Ed25519 Signature</div>
                  <div style={valueStyle}>{data.signature}</div>
                </div>
              )}

              <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(13,148,136,0.2)", background: "rgba(13,148,136,0.05)", fontSize: 12, color: "#0f766e", lineHeight: 1.6 }}>
                <b>Verification model:</b> shards are NOT exposed publicly. Reconstruction requires {data.threshold} of {data.totalShards} authenticated shards via <code>POST /api/quantum-shield/{data.id}/reconstruct</code>. The server runs Lagrange interpolation, derives the Ed25519 private key, signs a probe message, and verifies against the public key shown above — never exposing the key itself.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
              <Link href="/quantum-shield" style={{ padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>&#8592; Dashboard</Link>
              <Link href="/qsign" style={{ padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>QSign</Link>
              <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>QRight</Link>
              <Link href="/bureau" style={{ padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid rgba(15,23,42,0.15)", color: "#0f172a" }}>Bureau</Link>
              <Link href="/planet" style={{ padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, border: "1px solid #0f766e", color: "#0f766e" }}>Planet</Link>
            </div>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
