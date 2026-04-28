"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { ldWallet, svWallet, recordPlay } from "../aev/aevToken";

// AEV connector — Proof-of-Play engine A: успешные signing/verify действия mint'ят
// AEV в общий wallet. Возвращает количество сminted AEV или 0 если cap/off-mode.
function mintAevQSign(action: "qsign_sign" | "qsign_verify"): number {
  try {
    const w = ldWallet();
    if (!w.modes.play) return 0;
    const before = w.balance;
    const next = recordPlay(w, action, "qsign");
    if (next === w) return 0;
    svWallet(next);
    return next.balance - before;
  } catch { return 0; }
}

export default function QSignPage() {
  const { showToast } = useToast();
  const [payloadText, setPayloadText] = useState('{ "hello": "AEVION" }');
  const [signature, setSignature] = useState("");
  const [verifySignature, setVerifySignature] = useState("");
  const [result, setResult] = useState("");
  const [payloadOrigin, setPayloadOrigin] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("payload");
      if (!raw) return;
      const decoded = decodeURIComponent(raw);
      JSON.parse(decoded);
      setPayloadText(decoded);
      setPayloadOrigin("deep link (QRight / Globus)");
    } catch {}
  }, []);

  const sign = async () => {
    setResult(""); setSigning(true);
    try {
      const payload = JSON.parse(payloadText);
      const res = await fetch(apiUrl("/api/qsign/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult(`Error: ${(data as any).error || res.status}`); showToast("Signing failed", "error"); return; }
      setSignature((data as any).signature || "");
      setResult(JSON.stringify(data, null, 2));
      showToast("Payload signed successfully", "success");
      const aev = mintAevQSign("qsign_sign");
      if (aev > 0) setTimeout(() => showToast(`◆ +${aev.toFixed(2)} AEV · QSign · подпись`, "success"), 600);
    } catch (e: any) {
      setResult("Error: " + (e?.message || String(e)));
      showToast("Signing error", "error");
    } finally { setSigning(false); }
  };

  const verify = async () => {
    setResult(""); setVerifying(true);
    try {
      const payload = JSON.parse(payloadText);
      const res = await fetch(apiUrl("/api/qsign/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, signature: verifySignature || signature }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.valid) {
        showToast("Signature VALID", "success");
        const aev = mintAevQSign("qsign_verify");
        if (aev > 0) setTimeout(() => showToast(`◆ +${aev.toFixed(2)} AEV · QSign · verify`, "info"), 600);
      } else showToast("Signature INVALID", "error");
    } catch (e: any) {
      setResult("Error: " + e.message);
      showToast("Verification error", "error");
    } finally { setVerifying(false); }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.15)",
    fontSize: 14,
  };

  return (
    <main>
      <ProductPageShell maxWidth={900}>
        <Wave1Nav />
        <PipelineSteps current="qsign" />

        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", padding: "24px 24px 18px", color: "#fff" }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.02em" }}>QSign — Cryptographic Signatures</h1>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
              Sign and verify data integrity using HMAC-SHA256. The same payload format used by QRight and IP Bureau — ensuring end-to-end consistency across the pipeline.
            </p>
          </div>
        </div>

        {payloadOrigin ? (
          <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(15,118,110,0.25)", background: "rgba(15,118,110,0.06)", fontSize: 13, color: "#0f766e", fontWeight: 600 }}>
            Payload received from: {payloadOrigin}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <Link href="/qright" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
            ← QRight
          </Link>
          <Link href="/bureau" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
            IP Bureau →
          </Link>
          <Link href="/planet" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0f766e", textDecoration: "none", color: "#0f766e", fontWeight: 700, fontSize: 13 }}>
            Planet
          </Link>
        </div>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          {/* Left: Sign */}
          <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>1. Sign payload</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Payload (JSON)</div>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={6}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Paste any JSON object — it will be signed with HMAC-SHA256
              </div>
            </div>

            <button onClick={sign} disabled={signing}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: signing ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: signing ? "default" : "pointer", marginBottom: 12 }}>
              {signing ? "Signing..." : "Sign"}
            </button>

            {signature ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Signature (HMAC)</div>
                <input value={signature} readOnly style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, color: "#475569", background: "#f8fafc" }} />
              </div>
            ) : null}
          </div>

          {/* Right: Verify */}
          <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>2. Verify signature</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Signature to verify</div>
              <input
                value={verifySignature}
                onChange={(e) => setVerifySignature(e.target.value)}
                placeholder="Leave empty to use the signature from step 1"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                If empty, the signature generated above will be used
              </div>
            </div>

            <button onClick={verify} disabled={verifying}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: verifying ? "#94a3b8" : "#0d9488", color: "#fff", fontWeight: 800, fontSize: 14, cursor: verifying ? "default" : "pointer" }}>
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </div>
        </div>

        {/* Result */}
        {result ? (
          <div style={{ marginTop: 20, border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Result</div>
            <pre style={{ background: "#f8fafc", padding: 14, borderRadius: 10, fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "monospace", color: "#334155", margin: 0 }}>
              {result}
            </pre>
          </div>
        ) : null}

        {/* How it works */}
        <div style={{ marginTop: 24, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "rgba(15,23,42,0.02)" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>How QSign works</div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            QSign uses HMAC-SHA256 to create a cryptographic signature of your data. The same key is used by QRight and IP Bureau, 
            ensuring that any object registered in QRight can be verified for integrity at any point in the pipeline. 
            The signature proves that the data has not been tampered with since it was signed.
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
