"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { useToast } from "@/components/ToastProvider";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Notary = {
  id: string;
  fullName: string;
  licenseNumber: string;
  jurisdiction: string;
  city: string | null;
  publicKeyFingerprint: string;
};

type NotarizeStatus = {
  id: string;
  status: "pending" | "signed" | "rejected" | "revoked";
  notaryId: string;
  notaryName: string;
  jurisdiction: string;
  publicKeyFingerprint: string;
  signedAt: string;
  notaryRegistryRef: string | null;
};

type Step = "loading" | "already-notarized" | "already-pending" | "pick-notary" | "submitting" | "pending" | "signed" | "error";

const JURISDICTION_LABELS: Record<string, string> = {
  KZ: "Kazakhstan", EU: "European Union", US: "United States",
};

export default function NotarizePage() {
  const params = useParams();
  const certId = (params?.certId as string) || "";
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>("loading");
  const [notaries, setNotaries] = useState<Notary[]>([]);
  const [selectedNotary, setSelectedNotary] = useState<string>("");
  const [status, setStatus] = useState<NotarizeStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    } catch {
      return { "Content-Type": "application/json" };
    }
  };

  const loadStatus = async (): Promise<NotarizeStatus | null> => {
    try {
      const r = await fetch(apiUrl(`/api/bureau/cert/${certId}/notarize/status`), { headers: authHeaders() });
      if (r.status === 404) return null;
      if (!r.ok) return null;
      return (await r.json()) as NotarizeStatus;
    } catch {
      return null;
    }
  };

  const loadNotaries = async (): Promise<Notary[]> => {
    try {
      const r = await fetch(apiUrl("/api/bureau/notaries"));
      if (!r.ok) return [];
      const j = (await r.json()) as { notaries?: Notary[] };
      return j.notaries ?? [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (!certId) return;
    (async () => {
      const [existing, list] = await Promise.all([loadStatus(), loadNotaries()]);
      setNotaries(list);
      if (existing) {
        setStatus(existing);
        if (existing.status === "signed") { setStep("signed"); return; }
        if (existing.status === "pending") { setStep("pending"); return; }
      }
      if (list.length > 0) setSelectedNotary(list[0].id);
      setStep("pick-notary");
    })();
  }, [certId]);

  // Poll while pending
  useEffect(() => {
    if (step !== "pending") return;
    const interval = setInterval(async () => {
      const s = await loadStatus();
      if (!s) return;
      setStatus(s);
      if (s.status === "signed") { setStep("signed"); clearInterval(interval); }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, certId]);

  const submitRequest = async () => {
    if (!selectedNotary) { showToast("Select a notary", "error"); return; }
    setStep("submitting");
    try {
      const r = await fetch(apiUrl(`/api/bureau/cert/${certId}/notarize/request`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ notaryId: selectedNotary }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErrorMsg((json as any).error || "Request failed");
        setStep("error");
        return;
      }
      const s = await loadStatus();
      setStatus(s);
      setStep("pending");
    } catch {
      setErrorMsg("Network error");
      setStep("error");
    }
  };

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div className="min-h-screen bg-slate-950 text-slate-100 pt-20 pb-24 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Back */}
          <Link href={`/bureau/cert/${certId}`} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">
            ← Certificate
          </Link>

          {/* Title */}
          <div>
            <div className="text-xs text-violet-400 uppercase tracking-widest mb-2">Phase C</div>
            <h1 className="text-2xl font-bold text-white">Request Notarization</h1>
            <p className="text-slate-400 text-sm mt-2">
              Upgrade your certificate to <span className="text-violet-300 font-medium">Notarized</span> tier.
              A licensed notarial partner will co-sign your IP claim with an Ed25519 digital signature.
            </p>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`px-2 py-0.5 rounded ${step === "pick-notary" ? "bg-violet-800 text-violet-200" : "bg-slate-800 text-slate-500"}`}>1. Select Notary</span>
            <span className="text-slate-700">→</span>
            <span className={`px-2 py-0.5 rounded ${step === "pending" || step === "submitting" ? "bg-violet-800 text-violet-200" : "bg-slate-800 text-slate-500"}`}>2. Review</span>
            <span className="text-slate-700">→</span>
            <span className={`px-2 py-0.5 rounded ${step === "signed" ? "bg-emerald-800 text-emerald-200" : "bg-slate-800 text-slate-500"}`}>3. Signed</span>
          </div>

          {/* Loading */}
          {step === "loading" && (
            <div className="text-slate-400 animate-pulse py-10 text-center">Loading…</div>
          )}

          {/* Pick notary */}
          {step === "pick-notary" && (
            <div className="space-y-4">
              {notaries.length === 0 ? (
                <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-5 text-yellow-400 text-sm">
                  No active notaries available right now. Please check back soon.
                  <Link href="/bureau/notaries" className="block mt-2 text-yellow-300 underline text-xs">View notary registry</Link>
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {notaries.map((n) => (
                      <label
                        key={n.id}
                        className={`flex items-start gap-4 bg-slate-900 rounded-xl border p-4 cursor-pointer transition-colors ${selectedNotary === n.id ? "border-violet-600 bg-violet-950/20" : "border-slate-800 hover:border-slate-700"}`}
                      >
                        <input
                          type="radio"
                          name="notary"
                          value={n.id}
                          checked={selectedNotary === n.id}
                          onChange={() => setSelectedNotary(n.id)}
                          className="mt-1 accent-violet-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-100">{n.fullName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {JURISDICTION_LABELS[n.jurisdiction] || n.jurisdiction}
                            {n.city ? `, ${n.city}` : ""}
                          </div>
                          <div className="text-xs font-mono text-slate-600 mt-0.5 truncate">
                            {n.licenseNumber}
                          </div>
                        </div>
                        <Link
                          href={`/bureau/notaries/${n.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-teal-400 hover:text-teal-300 transition-colors shrink-0"
                        >
                          Public key →
                        </Link>
                      </label>
                    ))}
                  </div>

                  <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 text-xs text-slate-500 space-y-1">
                    <p>By submitting, you confirm that you are the original author of the work protected by this certificate.</p>
                    <p>The notary will independently verify your claim. Processing typically takes 1–3 business days.</p>
                  </div>

                  <button
                    onClick={submitRequest}
                    disabled={!selectedNotary}
                    className="w-full bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold transition-colors"
                  >
                    Submit Notarization Request
                  </button>
                </>
              )}
            </div>
          )}

          {/* Submitting */}
          {step === "submitting" && (
            <div className="text-center py-10">
              <div className="animate-spin text-3xl mb-4">⏳</div>
              <p className="text-slate-400">Submitting request…</p>
            </div>
          )}

          {/* Pending */}
          {step === "pending" && status && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-900/40 border border-yellow-700 flex items-center justify-center text-xl shrink-0">⏳</div>
                <div>
                  <div className="font-semibold text-yellow-300">Pending Review</div>
                  <div className="text-xs text-slate-500">Notary: {status.notaryName} · {status.jurisdiction}</div>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Your request has been submitted. The notary is reviewing your authorship claim.
                This page will update automatically when the notary signs.
              </p>
              <div className="text-xs text-slate-600 animate-pulse">Checking for updates…</div>
            </div>
          )}

          {/* Signed */}
          {step === "signed" && status && (
            <div className="bg-slate-900 rounded-xl border border-violet-700 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-900/40 border border-violet-600 flex items-center justify-center text-xl shrink-0">✅</div>
                <div>
                  <div className="font-semibold text-violet-300">Notarized!</div>
                  <div className="text-xs text-slate-500">Signed by {status.notaryName}</div>
                </div>
              </div>
              <dl className="text-xs space-y-1.5">
                <div className="flex gap-2">
                  <dt className="text-slate-500 shrink-0">Signed</dt>
                  <dd className="text-slate-300">{new Date(status.signedAt).toLocaleString()}</dd>
                </div>
                {status.notaryRegistryRef && (
                  <div className="flex gap-2">
                    <dt className="text-slate-500 shrink-0">Registry ref</dt>
                    <dd className="font-mono text-teal-300">{status.notaryRegistryRef}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-slate-500 shrink-0">Key fingerprint</dt>
                  <dd className="font-mono text-slate-400 break-all">{status.publicKeyFingerprint}</dd>
                </div>
              </dl>
              <Link
                href={`/bureau/cert/${certId}`}
                className="inline-block bg-violet-700 hover:bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                View Notarized Certificate →
              </Link>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="bg-red-950/30 border border-red-800 rounded-xl p-5 text-red-400 text-sm">
                {errorMsg}
              </div>
              <button
                onClick={() => setStep("pick-notary")}
                className="text-sm text-teal-400 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </ProductPageShell>
  );
}
