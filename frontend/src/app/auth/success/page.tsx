"use client";

// OAuth success landing — receives ?token=<jwt>&provider=<google|github>
// from the backend OAuth bridge (see aevion-globus-backend/src/routes/authOauth.ts).
//
// Polished version: dark theme, provider badge, copy-token-for-developers,
// auto-redirect with progress bar, and a manual continue button so users
// aren't stuck if redirect fails. Strips the token from the URL bar before
// any third-party asset can read it via Referer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";
const AUTO_REDIRECT_MS = 2500;

type Status = "loading" | "ok" | "missing";

// Provider metadata — keep the labels matched to the backend's id values
// ("google"|"github"). Adding a provider here is the only frontend change
// needed when authOauth.ts grows a new one.
const PROVIDERS: Record<string, { name: string; emoji: string; color: string }> = {
  google: { name: "Google", emoji: "G", color: "#ea4335" },
  github: { name: "GitHub", emoji: "GH", color: "#fafafa" },
};

export default function AuthSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [provider, setProvider] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("token");
    const p = sp.get("provider");

    if (!t) {
      setStatus("missing");
      return;
    }

    setToken(t);
    if (p && PROVIDERS[p]) setProvider(p);

    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {}
    // Strip token from URL bar immediately so referer / history sync /
    // server logs can't leak the secret.
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {}

    setStatus("ok");
  }, []);

  // Fetch /me so the success card can greet the user by name instead of
  // showing a generic "Signed in" message.
  useEffect(() => {
    if (status !== "ok" || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.user) setUser(data.user);
      } catch {
        // /me failure is non-fatal — the token is already stored, the user
        // can still proceed manually.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  // Progress bar + auto-redirect. Cancellable so users who want to stay
  // (e.g. to copy the dev token) can opt out.
  useEffect(() => {
    if (status !== "ok" || !autoRedirect) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / AUTO_REDIRECT_MS) * 100);
      setProgress(pct);
      if (elapsed >= AUTO_REDIRECT_MS) {
        window.clearInterval(id);
        router.replace("/auth");
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [status, autoRedirect, router]);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / non-secure context: fall back to selecting the
      // textarea — the user can Ctrl+C manually.
    }
  };

  const cancelRedirect = () => {
    setAutoRedirect(false);
    setProgress(0);
  };

  const providerMeta = provider ? PROVIDERS[provider] : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {status === "loading" ? (
          <LoadingCard />
        ) : status === "missing" ? (
          <MissingCard />
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
            {/* Header with success animation */}
            <div className="bg-gradient-to-br from-emerald-600/20 via-teal-600/15 to-cyan-600/20 px-6 pt-8 pb-6 text-center border-b border-slate-700/60">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 mb-4 animate-pulse">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Signed in</h1>
              {providerMeta ? (
                <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: providerMeta.color }}
                    aria-hidden="true"
                  />
                  <span>
                    via <span className="font-semibold text-white">{providerMeta.name}</span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mt-1">Welcome back</p>
              )}
            </div>

            {/* User card */}
            <div className="px-6 py-5 border-b border-slate-700/60">
              {user ? (
                <div>
                  <div className="text-sm text-slate-400 mb-1">Signed in as</div>
                  <div className="text-base font-semibold text-white">
                    {user.name || user.email || "AEVION user"}
                  </div>
                  {user.email && user.name ? (
                    <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                  ) : null}
                  {user.role ? (
                    <div className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      {user.role}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
                  <span>Loading profile…</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-6 py-5 space-y-2.5">
              <Link
                href="/auth"
                className="block w-full text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold text-sm transition shadow-lg shadow-teal-500/20"
                onClick={cancelRedirect}
              >
                Continue to account
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/qright"
                  className="text-center px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
                  onClick={cancelRedirect}
                >
                  Open QRight
                </Link>
                <Link
                  href="/planet"
                  className="text-center px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition"
                  onClick={cancelRedirect}
                >
                  Planet Lab
                </Link>
              </div>
            </div>

            {/* Developer token */}
            <details className="border-t border-slate-700/60">
              <summary className="cursor-pointer px-6 py-3 text-xs font-semibold text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition select-none">
                JWT token (for developers)
              </summary>
              <div className="px-6 pb-4">
                <div className="relative">
                  <textarea
                    readOnly
                    value={token}
                    rows={3}
                    className="w-full font-mono text-[10px] p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-400 resize-none"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={copyToken}
                    className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    type="button"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Treat this like a password. Anyone with it can act as you until it expires.
                </div>
              </div>
            </details>

            {/* Auto-redirect progress */}
            {autoRedirect ? (
              <div className="px-6 pb-5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                  <span>Redirecting to /auth…</span>
                  <button
                    onClick={cancelRedirect}
                    className="text-slate-400 hover:text-slate-200 underline"
                    type="button"
                  >
                    Stay here
                  </button>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm shadow-2xl p-8 text-center">
      <div className="inline-block w-10 h-10 border-3 border-slate-700 border-t-teal-400 rounded-full animate-spin mb-4" />
      <div className="text-base font-bold text-white mb-1">Finishing sign-in</div>
      <div className="text-sm text-slate-400">Storing your session token…</div>
    </div>
  );
}

function MissingCard() {
  return (
    <div className="rounded-2xl border border-amber-700/40 bg-slate-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="bg-amber-500/10 px-6 pt-8 pb-6 text-center border-b border-amber-700/30">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400/40 mb-4">
          <svg
            className="w-8 h-8 text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0 3.75h.008v.008H12V16.5zM12 3l9 18H3l9-18z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Token missing</h1>
        <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
          The OAuth callback didn&apos;t carry a token. The provider may have cancelled or rejected
          the sign-in. Please try again.
        </p>
      </div>
      <div className="px-6 py-5">
        <Link
          href="/auth"
          className="block w-full text-center px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-white text-slate-900 font-bold text-sm transition"
        >
          Back to sign-in
        </Link>
      </div>
    </div>
  );
}
