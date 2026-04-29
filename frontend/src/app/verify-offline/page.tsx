"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import {
  isAevionBundle,
  verifyAevionBundle,
  type AevionBundle,
  type BundleVerificationResult,
} from "@/lib/verifyBundle";

type State =
  | { stage: "idle" }
  | { stage: "verifying"; fileName: string }
  | {
      stage: "done";
      fileName: string;
      bundle: AevionBundle;
      result: BundleVerificationResult;
    }
  | { stage: "error"; fileName: string; error: string };

export default function VerifyOfflinePage() {
  const [state, setState] = useState<State>({ stage: "idle" });
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    setState({ stage: "verifying", fileName: file.name });
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isAevionBundle(parsed)) {
        throw new Error(
          "This file is not an AEVION verification bundle (missing bundleType marker).",
        );
      }
      const bundle = parsed as AevionBundle;
      const result = await verifyAevionBundle(bundle);
      setState({ stage: "done", fileName: file.name, bundle, result });
    } catch (e) {
      setState({
        stage: "error",
        fileName: file.name,
        error: (e as Error).message,
      });
    }
  };

  const reset = () => setState({ stage: "idle" });

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", padding: "20px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff" }}>A</div>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>AEVION</span>
          </a>
          <div style={{ fontSize: 12, color: "#64748b" }}>Offline Verification</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
          Verify a certificate offline
          <InfoTip
            label="Offline verification"
            text="Drop an AEVION bundle JSON. All checks run in your browser using SHA-256 and Ed25519 — no network call to AEVION. If the math passes, the certificate is authentic regardless of whether AEVION still exists."
          />
        </h1>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 24 }}>
          A verification bundle is a single <code style={{ fontSize: 12, padding: "1px 5px", background: "#e2e8f0", borderRadius: 4 }}>.json</code> file
          containing every proof needed to authenticate an AEVION certificate independently.
          This page runs every check locally — no network call to AEVION — so the certificate
          remains verifiable forever, even if our servers go dark.
        </p>

        {state.stage === "idle" && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            style={{
              display: "block",
              borderRadius: 16,
              border: `2px dashed ${drag ? "#0d9488" : "rgba(15,23,42,0.2)"}`,
              background: drag ? "rgba(13,148,136,0.04)" : "#fff",
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden>📄</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
              Drop bundle.json here, or click to choose a file
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Get a bundle from any AEVION certificate via &ldquo;Download verification bundle&rdquo;
            </div>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              style={{ display: "none" }}
            />
          </label>
        )}

        {state.stage === "verifying" && (
          <div role="status" aria-live="polite" style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>⚡</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              Verifying {state.fileName}…
            </div>
          </div>
        )}

        {state.stage === "error" && (
          <div role="alert" style={{ borderRadius: 16, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)", padding: "20px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#991b1b", marginBottom: 6 }}>
              ❌ Could not parse bundle
            </div>
            <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 14 }}>
              {state.error}
            </div>
            <button onClick={reset} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #991b1b", background: "#fff", color: "#991b1b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Try another file
            </button>
          </div>
        )}

        {state.stage === "done" && (
          <ResultView state={state} reset={reset} />
        )}
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: "pass" | "fail" | "skip" }) {
  const map = {
    pass: { bg: "rgba(16,185,129,0.12)", color: "#059669", label: "✓ pass" },
    fail: { bg: "rgba(239,68,68,0.12)", color: "#dc2626", label: "✗ fail" },
    skip: { bg: "rgba(100,116,139,0.12)", color: "#475569", label: "—  n/a" },
  } as const;
  const m = map[status];
  return (
    <span style={{ padding: "3px 8px", borderRadius: 6, background: m.bg, color: m.color, fontSize: 10, fontWeight: 800 }}>
      {m.label}
    </span>
  );
}

function ResultView({
  state,
  reset,
}: {
  state: { stage: "done"; fileName: string; bundle: AevionBundle; result: BundleVerificationResult };
  reset: () => void;
}) {
  const { result, bundle } = state;
  const cert = bundle.certificate;
  const headerBg =
    result.overall === "pass"
      ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(13,148,136,0.06))"
      : "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.06))";
  const headerColor = result.overall === "pass" ? "#059669" : "#dc2626";
  const checks: Array<{
    label: string;
    tip: { name: string; text: string };
    s: { status: "pass" | "fail" | "skip"; detail: string };
  }> = [
    {
      label: "Bundle shape",
      tip: { name: "Bundle shape", text: "Quick check that the file is a recognized AEVION verification bundle (correct version, expected fields)." },
      s: result.bundleShape,
    },
    {
      label: "Content hash",
      tip: { name: "Content hash", text: "Recompute SHA-256 of the canonical inputs and compare to the stored value. A match proves no metadata field changed since protection." },
      s: result.contentHash,
    },
    {
      label: "AEVION Ed25519 signature",
      tip: { name: "AEVION signature", text: "Verify the platform's Ed25519 signature with the embedded public key. Independent of AEVION servers — uses only your browser's WebCrypto." },
      s: result.aevionSignature,
    },
    {
      label: "Author co-signature",
      tip: { name: "Author co-signature", text: "Verify the second Ed25519 signature held only by the original author. Even total AEVION compromise cannot forge this layer." },
      s: result.authorCosignature,
    },
    {
      label: "Bitcoin anchor (OpenTimestamps)",
      tip: { name: "Bitcoin anchor", text: "Presence check: does the bundle carry a Bitcoin-confirmed timestamp? For full mathematical proof, run the .ots bytes through any OpenTimestamps client against a Bitcoin node." },
      s: result.bitcoinAnchor,
    },
  ];

  return (
    <div>
      <div style={{ borderRadius: 16, padding: "24px 20px", marginBottom: 20, textAlign: "center", background: headerBg, border: `1px solid ${result.overall === "pass" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
        <div style={{ fontSize: 40, marginBottom: 6 }} aria-hidden>
          {result.overall === "pass" ? "✅" : "⚠️"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: headerColor, marginBottom: 4 }}>
          {result.overall === "pass" ? "Bundle verified offline" : "Verification failed"}
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>
          {state.fileName}
        </div>
      </div>

      {/* Certificate summary */}
      <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Certificate</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{cert.title}</div>
        <div style={{ fontSize: 12, color: "#475569", display: "grid", gap: 4 }}>
          <div><b>Author:</b> {cert.author || "Anonymous"}</div>
          <div><b>Type:</b> {cert.kind}</div>
          {cert.protectedAt && (
            <div><b>Protected:</b> {new Date(cert.protectedAt).toLocaleString()}</div>
          )}
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginTop: 4, wordBreak: "break-all" as const }}>
            ID: {cert.id}
          </div>
        </div>
      </div>

      {/* Per-check verdicts */}
      <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center" }}>
          Per-layer verdict
          <InfoTip
            label="Per-layer verdict"
            text="Each row is one independent cryptographic test, run in your browser. A bundle is fully valid only when every applicable layer passes."
          />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {checks.map((c) => (
            <div key={c.label} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.06)", background: c.s.status === "pass" ? "rgba(16,185,129,0.04)" : c.s.status === "fail" ? "rgba(239,68,68,0.04)" : "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <StatusPill status={c.s.status} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{c.label}</span>
                <InfoTip label={c.tip.name} text={c.tip.text} size={12} />
              </div>
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                {c.s.detail || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Independence note */}
      {bundle.proofs.openTimestamps?.proofBase64 && (
        <div style={{ borderRadius: 14, border: "1px solid rgba(247,147,26,0.25)", background: "linear-gradient(135deg, rgba(247,147,26,0.06), rgba(15,23,42,0.02))", padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#9a3412", marginBottom: 6, display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 18, marginRight: 6 }} aria-hidden>₿</span>
            Mathematically anchored to Bitcoin
          </div>
          <div style={{ fontSize: 11, color: "#7c2d12", lineHeight: 1.6 }}>
            For full mathematical proof of timestamp, decode <code>proofs.openTimestamps.proofBase64</code> with any
            OpenTimestamps client (e.g. <code>ots-cli verify proof.ots</code>) and check it against a Bitcoin block
            explorer. Once a proof is confirmed at a block height, the certificate&apos;s prior existence is
            mathematically irrefutable — Bitcoin itself is the trust anchor.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={reset}
          style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          Verify another bundle
        </button>
        <a
          href={`/verify/${cert.id}`}
          style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid #0d9488", background: "#fff", color: "#0d9488", fontWeight: 700, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          See full online record →
        </a>
      </div>
    </div>
  );
}
