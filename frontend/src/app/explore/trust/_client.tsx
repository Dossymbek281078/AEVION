"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl, getClientApiBase } from "@/lib/apiBase";

// AEVION Trust Score — full transparency page. Shows the live signed KPI, its
// Ed25519 attestation, and lets anyone anchor the current value into Bitcoin
// (OpenTimestamps) and download the .ots proof to verify independently.

interface PerModule { measuredPct: number; realPct: number; total: number }
interface Attestation {
  alg: string; asOf: string; contentHash: string;
  signature: string; publicKey: string; keyFingerprint: string;
  ephemeral: boolean; note: string;
}
interface SignedScore {
  score: number; realPct: number; totalItems: number;
  measured: number; derived: number; guessed: number;
  modulesReporting: number; perModule: Record<string, PerModule>;
  note?: string; attestation?: Attestation;
}
interface AnchorState {
  status: "pending" | "bitcoin-confirmed" | "failed";
  contentHash: string; otsProofB64: string | null;
  bitcoinBlockHeight: number | null; calendars: string[];
  error: string | null; note: string;
}

const TEAL = "#2dd4bf";
const TEAL_SOFT = "#5eead4";
const INK = "#e2e8f0";
const MUTE = "#94a3b8";
const PANEL = "#0f172a";
const BORDER = "rgba(45,212,191,0.22)";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.12)", fontSize: 13 }}>
      <span style={{ color: MUTE, minWidth: 150 }}>{label}</span>
      <span style={{ color: INK, wordBreak: "break-all", fontFamily: mono ? "ui-monospace, monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

export default function TrustClient() {
  const [ts, setTs] = useState<SignedScore | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const [anchorSnapshot, setAnchorSnapshot] = useState<SignedScore | null>(null);
  const [verifyOut, setVerifyOut] = useState<string | null>(null);
  const displayBase = getClientApiBase();

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/data-quality/trust-score"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setTs(j); })
      .catch(() => { if (alive) setLoadErr(true); });
    return () => { alive = false; };
  }, []);

  const runAnchor = useCallback(async () => {
    setAnchoring(true); setAnchor(null); setVerifyOut(null);
    try {
      const r = await fetch(apiUrl("/api/data-quality/trust-score/anchor"), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      // Ошибка сервера — тот же ЧЕСТНЫЙ отказ, что и обрыв связи.
      // Без этой ветки при 500 `j.anchor` оказывался пустым, и экран
      // показывал НИЧЕГО вместо «не удалось»: человек не мог понять,
      // закрепилась его оценка доверия или нет. Состояние отказа в
      // файле уже смоделировано ниже — используем его, а не своё.
      if (!r.ok) {
        setAnchor({ status: "failed", contentHash: "", otsProofB64: null, bitcoinBlockHeight: null, calendars: [], error: `server error ${r.status}`, note: "Could not reach the anchor endpoint." });
        return;
      }
      const j = await r.json();
      setAnchor(j.anchor); setAnchorSnapshot(j.snapshot);
    } catch {
      setAnchor({ status: "failed", contentHash: "", otsProofB64: null, bitcoinBlockHeight: null, calendars: [], error: "network error", note: "Could not reach the anchor endpoint." });
    } finally { setAnchoring(false); }
  }, []);

  const downloadProof = useCallback(() => {
    if (!anchor?.otsProofB64 || !anchorSnapshot) return;
    const bundle = { snapshot: anchorSnapshot, otsProofB64: anchor.otsProofB64, savedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aevion-trust-score-${anchor.contentHash.slice(0, 12)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [anchor, anchorSnapshot]);

  const reverify = useCallback(async () => {
    if (!anchorSnapshot || !anchor?.otsProofB64) return;
    setVerifyOut("Verifying…");
    try {
      const r = await fetch(apiUrl("/api/data-quality/trust-score/anchor/verify"), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: anchorSnapshot, otsProofB64: anchor.otsProofB64 }),
      });
      const j = await r.json();
      setVerifyOut(JSON.stringify(j, null, 2));
    } catch { setVerifyOut("verify request failed"); }
  }, [anchorSnapshot, anchor]);

  const att = ts?.attestation;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 80px", color: INK, lineHeight: 1.55 }}>
      <a href="/explore" style={{ color: TEAL_SOFT, fontSize: 13, textDecoration: "none" }}>← Explore</a>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "14px 0 6px", color: "#f8fafc" }}>AEVION Trust Score</h1>
      <p style={{ color: MUTE, fontSize: 15, marginTop: 0 }}>
        An honest, cryptographically-signed measure of how much of the platform&apos;s data is actually
        measured — not estimated. Signed with Ed25519 and anchorable into Bitcoin, so anyone can verify it
        with zero trust in AEVION.
      </p>

      {loadErr && <p style={{ color: "#fb7185" }}>Trust Score is unavailable right now. Please try again in a minute.</p>}

      {ts && (
        <>
          <section style={{ display: "flex", alignItems: "baseline", gap: 16, margin: "26px 0 8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 54, fontWeight: 800, color: TEAL }}>{ts.score}%</span>
            <span style={{ color: MUTE }}>of platform data measured · {ts.realPct}% measured-or-derived · {ts.modulesReporting} module{ts.modulesReporting === 1 ? "" : "s"} · {ts.totalItems.toLocaleString()} items</span>
          </section>

          <section style={{ margin: "18px 0" }}>
            <h2 style={{ fontSize: 16, color: TEAL_SOFT, margin: "0 0 8px" }}>Per module</h2>
            {Object.entries(ts.perModule).map(([id, m]) => (
              <div key={id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                <span style={{ minWidth: 140, color: INK, fontWeight: 600 }}>{id}</span>
                <div style={{ flex: 1, height: 8, background: "rgba(148,163,184,0.15)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${m.measuredPct}%`, height: "100%", background: TEAL }} />
                </div>
                <span style={{ minWidth: 130, textAlign: "right", color: MUTE, fontSize: 13 }}>{m.measuredPct}% · {m.total.toLocaleString()} items</span>
              </div>
            ))}
          </section>

          {att && (
            <section style={{ margin: "26px 0", padding: "16px 18px", background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
              <h2 style={{ fontSize: 16, color: TEAL_SOFT, margin: "0 0 10px" }}>
                {att.ephemeral ? "⚠ Ephemeral signature" : "✓ Ed25519 signature"}
              </h2>
              <Row label="Algorithm" value={att.alg} />
              <Row label="Signed at (asOf)" value={att.asOf} />
              <Row label="Key fingerprint" value={att.keyFingerprint} mono />
              <Row label="Content hash" value={att.contentHash} mono />
              <Row label="Public key" value={att.publicKey} mono />
              <p style={{ fontSize: 12, color: MUTE, marginTop: 10, marginBottom: 0 }}>
                The signature commits to the numeric fields (score, counts, per-module, timestamp) — the KPI&apos;s
                actual meaning — not the human-readable description, so verification is transport-independent.
              </p>
              <a href={`${displayBase}/api/data-quality/trust-score/verify`} target="_blank" rel="noopener noreferrer" style={{ color: TEAL_SOFT, fontSize: 13, display: "inline-block", marginTop: 8 }}>
                Pin AEVION&apos;s public key →
              </a>
            </section>
          )}

          <section style={{ margin: "26px 0" }}>
            <h2 style={{ fontSize: 18, color: "#f8fafc", margin: "0 0 6px" }}>Anchor to Bitcoin</h2>
            <p style={{ color: MUTE, fontSize: 14, marginTop: 0 }}>
              Submit this exact value&apos;s hash to the OpenTimestamps calendar network. It gets anchored into a
              Bitcoin block (~1–6h), giving a timestamp no one — not even AEVION — can forge or backdate.
            </p>
            <button
              onClick={runAnchor}
              disabled={anchoring}
              style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${TEAL}`, background: anchoring ? "rgba(45,212,191,0.15)" : TEAL, color: anchoring ? TEAL_SOFT : "#062723", fontWeight: 700, fontSize: 14, cursor: anchoring ? "wait" : "pointer" }}
            >
              {anchoring ? "Anchoring…" : "⚓ Anchor current Trust Score"}
            </button>

            {anchor && (
              <div style={{ marginTop: 16, padding: "14px 16px", background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                <Row label="Anchor status" value={anchor.status === "pending" ? "pending (Bitcoin confirmation in ~1–6h)" : anchor.status === "bitcoin-confirmed" ? `Bitcoin-confirmed at block ${anchor.bitcoinBlockHeight}` : `failed: ${anchor.error ?? ""}`} />
                {anchor.contentHash && <Row label="Anchored hash" value={anchor.contentHash} mono />}
                {anchor.calendars.length > 0 && <Row label="Calendars" value={anchor.calendars.join(", ")} />}
                <p style={{ fontSize: 12, color: MUTE, margin: "10px 0 0" }}>{anchor.note}</p>
                {anchor.otsProofB64 && (
                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button onClick={downloadProof} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: TEAL_SOFT, fontSize: 13, cursor: "pointer" }}>⬇ Download proof (.json)</button>
                    <button onClick={reverify} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: TEAL_SOFT, fontSize: 13, cursor: "pointer" }}>Verify now</button>
                  </div>
                )}
                {verifyOut && (
                  <pre style={{ marginTop: 12, padding: 12, background: "#060b16", borderRadius: 8, fontSize: 11.5, color: INK, overflowX: "auto", maxHeight: 260 }}>{verifyOut}</pre>
                )}
              </div>
            )}
          </section>

          <section style={{ margin: "26px 0", fontSize: 13, color: MUTE }}>
            <h2 style={{ fontSize: 16, color: TEAL_SOFT, margin: "0 0 8px" }}>Verify independently</h2>
            <p style={{ marginTop: 0 }}>The downloaded proof holds the signed snapshot and its Bitcoin timestamp. Verify with the open-source OpenTimestamps client:</p>
            <pre style={{ padding: 12, background: "#060b16", borderRadius: 8, fontSize: 12, color: INK, overflowX: "auto" }}>{`# extract the .ots proof from the downloaded JSON (otsProofB64, base64) → proof.ots
ots verify proof.ots

# or re-check the AEVION attestation over the numeric payload:
curl -s ${displayBase}/api/data-quality/trust-score/verify`}</pre>
          </section>
        </>
      )}
    </main>
  );
}
