"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { InfoTip } from "@/components/InfoTip";
import { useToast } from "@/components/ToastProvider";
import { apiUrl } from "@/lib/apiBase";

type Step =
  | "intro"
  | "kyc-form"
  | "kyc-running"
  | "payment"
  | "applying"
  | "done"
  | "error";

type StatusResponse = {
  verificationId: string;
  kyc: {
    provider: string;
    status: string;
    verifiedName: string | null;
    verifiedCountry: string | null;
    decision: string | null;
  };
  payment: {
    provider: string | null;
    intentId: string | null;
    status: string;
    amountCents: number | null;
    currency: string | null;
  };
  ready: boolean;
};

export default function BureauUpgradePage() {
  const params = useParams();
  const certId = (params?.certId as string) || "";
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>("intro");
  const [declaredName, setDeclaredName] = useState("");
  const [declaredCountry, setDeclaredCountry] = useState("KZ");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* Auth headers — same convention used elsewhere */
  const TOKEN_KEY = "aevion_auth_token_v1";
  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  };

  /* Poll status while a verification is in progress. */
  useEffect(() => {
    if (!verificationId) return;
    if (step !== "kyc-running" && step !== "payment") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(
          apiUrl(`/api/bureau/verify/status/${verificationId}`),
          { headers: { ...authHeaders() } },
        );
        if (!r.ok) return;
        const data = (await r.json()) as StatusResponse;
        if (cancelled) return;
        setStatus(data);
        if (step === "kyc-running" && data.kyc.status === "approved") {
          setStep("payment");
        } else if (step === "kyc-running" && data.kyc.status === "rejected") {
          setStep("error");
          setErrorMsg(`KYC rejected: ${data.kyc.decision || "no reason given"}`);
        } else if (step === "payment" && data.ready) {
          // Both KYC approved + payment paid — apply upgrade
          await applyUpgrade(verificationId);
        }
      } catch {
        /* swallow; retry */
      }
    };
    const id = window.setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [verificationId, step]);

  const startKyc = async (e: FormEvent) => {
    e.preventDefault();
    if (!declaredName.trim()) {
      setErrorMsg("Please enter the name on your ID document.");
      return;
    }
    setErrorMsg(null);
    try {
      const r = await fetch(apiUrl("/api/bureau/verify/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          declaredName: declaredName.trim(),
          declaredCountry: declaredCountry.trim() || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      setVerificationId(data.verificationId);
      setStep("kyc-running");
      // Open the KYC widget in a new tab so the user can finish it.
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStep("error");
    }
  };

  const startPayment = async () => {
    if (!verificationId) return;
    try {
      const r = await fetch(apiUrl("/api/bureau/payment/intent"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ verificationId }),
      });
      const data = await r.json();
      if (!r.ok && r.status !== 409) {
        throw new Error(data?.error || `Error ${r.status}`);
      }
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      // From here onwards the polling effect will detect ready=true and
      // transition to "applying" / "done".
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStep("error");
    }
  };

  const applyUpgrade = async (vid: string) => {
    setStep("applying");
    try {
      const r = await fetch(apiUrl(`/api/bureau/upgrade/${certId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ verificationId: vid }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      setStep("done");
      showToast("Certificate upgraded to Verified!", "success");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStep("error");
    }
  };

  return (
    <main>
      <ProductPageShell maxWidth={680}>
        <Wave1Nav />

        {/* Header */}
        <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 22 }}>
          <div style={{ background: "linear-gradient(135deg, #312e81, #4f46e5)", padding: "22px 24px", color: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>UPGRADE TO VERIFIED</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
              Certify your real-name authorship
            </h1>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              Identity-verified certificates carry stronger evidentiary weight in
              IP disputes — the bureau attests that your government-issued ID
              matched the author named on this work.
            </div>
            <div style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.7, marginTop: 8 }}>
              Cert: {certId}
            </div>
          </div>
        </div>

        {/* Progress steps */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[
            { id: "kyc", label: "Identity" },
            { id: "pay", label: "Payment" },
            { id: "apply", label: "Apply" },
          ].map((s, i) => {
            const stepIdx =
              step === "intro" || step === "kyc-form" || step === "kyc-running"
                ? 0
                : step === "payment"
                  ? 1
                  : step === "applying" || step === "done"
                    ? 2
                    : 0;
            const active = i === stepIdx;
            const done = i < stepIdx || step === "done";
            return (
              <div key={s.id} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: done ? "rgba(16,185,129,0.1)" : active ? "rgba(99,102,241,0.1)" : "#f1f5f9", border: `1px solid ${done ? "rgba(16,185,129,0.3)" : active ? "rgba(99,102,241,0.3)" : "rgba(15,23,42,0.06)"}`, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: done ? "#059669" : active ? "#4f46e5" : "#94a3b8" }}>
                  {done ? "✓" : i + 1}. {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {step === "intro" && (
          <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>What you&apos;ll do</div>
            <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>
              <li><b>Identity check</b> via our KYC partner — passport / national ID upload, ~2 minutes.</li>
              <li><b>Pay $19</b> for the Verified-tier upgrade.</li>
              <li><b>Certificate is upgraded</b> with your real-name attestation; the verify page now shows &ldquo;Verified Author&rdquo;.</li>
            </ol>
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 11, color: "#92400e", lineHeight: 1.55 }}>
              <b>Privacy:</b> we store the KYC decision (verified name, country, document type) — not your ID image. Raw documents stay with the KYC vendor under their retention policy.
            </div>
            <button onClick={() => setStep("kyc-form")} style={{ marginTop: 16, padding: "12px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              Start identity check →
            </button>
          </div>
        )}

        {step === "kyc-form" && (
          <form onSubmit={startKyc} style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px", display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6, display: "block" }}>
                Full name on your ID document
                <InfoTip
                  label="Why we need this"
                  text="Pre-fills the KYC widget so the verification matches faster. The KYC vendor still cross-checks against your actual ID — typing the wrong name here just slows things down."
                />
              </label>
              <input
                value={declaredName}
                onChange={(e) => setDeclaredName(e.target.value)}
                aria-required="true"
                required
                placeholder="e.g. Aliya Nurgalieva"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6, display: "block" }}>
                Country of issue
              </label>
              <input
                value={declaredCountry}
                onChange={(e) => setDeclaredCountry(e.target.value)}
                placeholder="e.g. KZ, RU, US"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {errorMsg && (
              <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)", color: "#991b1b", fontSize: 12 }}>
                {errorMsg}
              </div>
            )}
            <button type="submit" style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              Open KYC widget →
            </button>
          </form>
        )}

        {step === "kyc-running" && (
          <div role="status" aria-live="polite" style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              Waiting for KYC to finish…
            </div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
              The KYC widget opened in a new tab. Finish the verification there.
              We&apos;ll auto-detect approval and continue here.
            </div>
            {status && (
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                Status: <b>{status.kyc.status}</b>
                {status.kyc.verifiedName && <> · Name: <b>{status.kyc.verifiedName}</b></>}
              </div>
            )}
          </div>
        )}

        {step === "payment" && (
          <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden>✓</span> Identity verified
              {status?.kyc.verifiedName && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                  &nbsp;· <b>{status.kyc.verifiedName}</b>
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
              Last step: $19 for the Verified-tier upgrade. After payment, the
              certificate is stamped with your real-name attestation
              automatically.
            </div>
            {!status?.payment.intentId ? (
              <button onClick={startPayment} style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                Continue to payment ($19) →
              </button>
            ) : (
              <div role="status" aria-live="polite" style={{ fontSize: 12, color: "#475569" }}>
                Awaiting payment confirmation… (intent: <code>{status.payment.intentId}</code>)
              </div>
            )}
          </div>
        )}

        {step === "applying" && (
          <div role="status" aria-live="polite" style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>⚡</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Applying upgrade to certificate…</div>
          </div>
        )}

        {step === "done" && (
          <div style={{ borderRadius: 14, border: "1px solid rgba(16,185,129,0.3)", background: "linear-gradient(135deg, rgba(16,185,129,0.05), rgba(13,148,136,0.05))", padding: "24px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 6 }} aria-hidden>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#065f46", marginBottom: 6 }}>
              Certificate upgraded to Verified!
            </div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
              The verify page now shows the &ldquo;Verified Author&rdquo; badge with your real-name
              attestation date. The bundle.json reflects the change automatically.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={`/verify/${certId}`} style={{ padding: "10px 16px", borderRadius: 10, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                Open verify page →
              </Link>
              <Link href="/bureau" style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                Back to bureau
              </Link>
            </div>
          </div>
        )}

        {step === "error" && (
          <div role="alert" style={{ borderRadius: 14, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.04)", padding: "20px 22px" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#991b1b", marginBottom: 6 }}>
              ❌ Upgrade did not complete
            </div>
            <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 12 }}>
              {errorMsg || "Something went wrong. No charge was applied if payment had not started."}
            </div>
            <button onClick={() => { setStep("intro"); setErrorMsg(null); setVerificationId(null); }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #991b1b", background: "#fff", color: "#991b1b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
