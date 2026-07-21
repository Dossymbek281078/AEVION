"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// AEVION Trust Score badge — the platform's honest data-provenance KPI, read from
// GET /api/data-quality/trust-score. Renders nothing until (and unless) the
// endpoint answers, so it is safe to ship before the backend is deployed and it
// never shows a fabricated number.

interface TrustScore {
  score: number;
  realPct: number;
  totalItems: number;
  modulesReporting: number;
  perModule: Record<string, { measuredPct: number; realPct: number; total: number }>;
  attestation?: {
    alg: string;
    asOf: string;
    keyFingerprint: string;
    ephemeral: boolean;
  };
}

export function TrustScoreBadge() {
  const [ts, setTs] = useState<TrustScore | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/data-quality/trust-score"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && typeof j.score === "number") setTs(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!ts) return null;
  const mods = Object.entries(ts.perModule);
  const att = ts.attestation;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          borderRadius: 999,
          border: "1px solid rgba(45,212,191,0.35)",
          background: "rgba(13,148,136,0.12)",
          color: "#5eead4",
          fontSize: 13,
          fontWeight: 600,
          cursor: "help",
          backdropFilter: "blur(4px)",
        }}
      >
        <span aria-hidden="true">🛡</span>
        <span>
          AEVION Trust Score:{" "}
          <b style={{ color: "#2dd4bf" }}>{ts.score}%</b> of platform data measured
        </span>
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
          · {ts.modulesReporting} module{ts.modulesReporting === 1 ? "" : "s"} reporting
        </span>
        {att && !att.ephemeral && (
          <span
            title={`Ed25519-signed · key ${att.keyFingerprint}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "1px 7px",
              borderRadius: 999,
              background: "rgba(45,212,191,0.18)",
              border: "1px solid rgba(45,212,191,0.4)",
              color: "#2dd4bf",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ✓ signed
          </span>
        )}
        {open && (
          <span
            role="tooltip"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              width: 300,
              background: "#0f172a",
              border: "1px solid rgba(45,212,191,0.25)",
              color: "#e2e8f0",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.5,
              padding: "10px 13px",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
              textAlign: "left",
              zIndex: 60,
              whiteSpace: "normal",
            }}
          >
            <b style={{ color: "#5eead4", display: "block", marginBottom: 4 }}>
              Share of data that is measured, not estimated
            </b>
            {ts.realPct}% is measured or derived from real signals; {mods.length} module
            {mods.length === 1 ? "" : "s"} report so far ({ts.totalItems.toLocaleString()} items).
            Coverage grows as more modules expose their provenance — this is not a
            planet-wide claim.
            <span style={{ display: "block", marginTop: 6 }}>
              {mods.map(([id, m]) => (
                <span key={id} style={{ display: "block", color: "#94a3b8" }}>
                  {id}: <b style={{ color: "#cbd5e1" }}>{m.measuredPct}%</b> measured · {m.total.toLocaleString()} items
                </span>
              ))}
            </span>
            {att && (
              <span style={{ display: "block", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(148,163,184,0.2)", color: "#94a3b8" }}>
                {att.ephemeral ? "⚠ signed with an ephemeral key" : "✓ Ed25519-signed"} · key{" "}
                <b style={{ color: "#cbd5e1", fontFamily: "monospace" }}>{att.keyFingerprint}</b>
                <a
                  href={apiUrl("/api/data-quality/trust-score/verify")}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "#5eead4", marginLeft: 6, textDecoration: "underline" }}
                >
                  verify
                </a>
                <a
                  href="/explore/trust"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "#5eead4", marginLeft: 8, textDecoration: "underline" }}
                >
                  anchor to Bitcoin →
                </a>
              </span>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
