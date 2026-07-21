"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { requestEmailVerification, completeEmailVerification, BuildApiError } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useI18n } from "@/lib/i18n";

export default function VerifyEmailPage() {
  return (
    <BuildShell>
      <Suspense fallback={null}>
        <VerifyEmailBody />
      </Suspense>
    </BuildShell>
  );
}

function VerifyEmailBody() {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const setUser = useBuildAuth((s) => s.setUser);
  const user = useBuildAuth((s) => s.user);

  const [token, setToken] = useState(params.get("token") ?? "");
  const [status, setStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-submit if token came from URL (email link click)
  useEffect(() => {
    const t = params.get("token");
    if (t) {
      setToken(t);
      void verify(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(t: string) {
    setStatus("verifying");
    setMsg(null);
    try {
      await completeEmailVerification(t);
      if (user) setUser({ ...user, emailVerifiedAt: new Date().toISOString() });
      setStatus("done");
      setTimeout(() => router.push("/build/profile"), 2500);
    } catch (e) {
      const err = e instanceof BuildApiError ? e.message : (e as Error).message;
      setMsg(err);
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="mb-4 text-4xl">📧</div>
        <h1 className="mb-2 text-xl font-bold text-white">{t("build.verifyEmail.title")}</h1>

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-emerald-300 text-lg">{t("build.verifyEmail.verifiedBanner")}</p>
            <p className="text-sm text-slate-400">{t("build.verifyEmail.redirecting")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              {t("build.verifyEmail.instructions")}
            </p>

            <div className="flex gap-2">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("build.verifyEmail.codePlaceholder")}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                disabled={!token.trim() || status === "verifying"}
                onClick={() => verify(token.trim())}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {status === "verifying" ? "…" : t("build.verifyEmail.confirmButton")}
              </button>
            </div>

            {msg && (
              <p className="text-sm text-rose-300">
                {msg === "invalid_or_expired_token"
                  ? t("build.verifyEmail.invalidOrExpired")
                  : msg}
              </p>
            )}

            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-xs text-slate-500">{t("build.verifyEmail.emailNotArrived")}</p>
              {sent ? (
                <p className="text-xs text-emerald-300">{t("build.verifyEmail.resentBanner")}</p>
              ) : (
                <button
                  disabled={sending}
                  onClick={async () => {
                    setSending(true);
                    try {
                      await requestEmailVerification();
                      setSent(true);
                    } catch {/**/}
                    finally { setSending(false); }
                  }}
                  className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                >
                  {sending ? t("build.verifyEmail.sending") : t("build.verifyEmail.resendButton")}
                </button>
              )}
            </div>

            <Link href="/build" className="block text-xs text-slate-500 hover:text-slate-300">
              {t("build.verifyEmail.backHome")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
