"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Step = "idle" | "accepting" | "done" | "error";

export default function BureauOrgAcceptPage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const router = useRouter();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    } catch {
      return { "Content-Type": "application/json" };
    }
  };

  const accept = async () => {
    setStep("accepting");
    setErrorMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/accept/${token}`), {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await r.json();
      if (!r.ok) {
        setErrorMsg((json as any).error || "Failed to accept invite");
        setStep("error");
        return;
      }
      setOrgId((json as any).orgId);
      setStep("done");
      setTimeout(() => router.push(`/bureau/org/${(json as any).orgId}`), 1800);
    } catch {
      setErrorMsg("Network error");
      setStep("error");
    }
  };

  const isAuthed = () => {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch { return false; }
  };

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-teal-900/40 border border-teal-700 flex items-center justify-center mx-auto text-2xl">
            🏢
          </div>
          <h1 className="text-xl font-bold text-white">Organization Invite</h1>

          {step === "idle" && (
            <>
              <p className="text-slate-400 text-sm">
                You have been invited to join an organization on AEVION IP Bureau.
                {!isAuthed() && (
                  <span className="block mt-2 text-yellow-400">
                    You need to be signed in to accept this invite.
                  </span>
                )}
              </p>
              {isAuthed() ? (
                <button
                  onClick={accept}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-3 font-semibold transition-colors"
                >
                  Accept Invite
                </button>
              ) : (
                <Link
                  href={`/auth?next=/bureau/org/accept/${token}`}
                  className="block w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-3 font-semibold transition-colors"
                >
                  Sign in to Accept
                </Link>
              )}
            </>
          )}

          {step === "accepting" && (
            <div className="text-slate-400 animate-pulse py-4">Accepting invite…</div>
          )}

          {step === "done" && (
            <>
              <div className="text-teal-400 text-4xl">✓</div>
              <p className="text-slate-300 text-sm">You have joined the organization. Redirecting…</p>
              {orgId && (
                <Link href={`/bureau/org/${orgId}`} className="text-teal-400 underline text-sm">
                  Go to org now
                </Link>
              )}
            </>
          )}

          {step === "error" && (
            <>
              <div className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-4 py-3">
                {errorMsg}
              </div>
              <Link href="/bureau" className="text-teal-400 underline text-sm">
                Go to Bureau
              </Link>
            </>
          )}
        </div>
      </div>
    </ProductPageShell>
  );
}
