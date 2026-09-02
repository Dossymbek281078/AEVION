"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { requestPasswordReset, completePasswordReset, BuildApiError } from "@/lib/build/api";
import { useI18n } from "@/lib/i18n";

export default function ResetPasswordPage() {
  return (
    <BuildShell>
      <Suspense fallback={null}>
        <ResetPasswordBody />
      </Suspense>
    </BuildShell>
  );
}

function ResetPasswordBody() {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();

  const initToken = params.get("token") ?? "";
  const initEmail = params.get("email") ?? "";

  const [step, setStep] = useState<"request" | "complete">(initToken ? "complete" : "request");
  const [email, setEmail] = useState(initEmail);
  const [token, setToken] = useState(initToken);
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initToken) setStep("complete");
  }, [initToken]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof BuildApiError ? ex.message : (ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== newPass2) { setErr(t("build.resetPassword.errorMismatch")); return; }
    if (newPass.length < 6) { setErr(t("build.resetPassword.errorTooShort")); return; }
    setBusy(true);
    setErr(null);
    try {
      await completePasswordReset(email.trim(), token.trim(), newPass);
      setDone(true);
      setTimeout(() => router.push("/build"), 2000);
    } catch (ex) {
      const msg = ex instanceof BuildApiError ? ex.message : (ex as Error).message;
      setErr(msg === "invalid_or_expired_token" ? t("build.resetPassword.errorExpiredToken") : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl">🔑</div>
          <h1 className="mt-2 text-xl font-bold text-white">
            {step === "request" ? t("build.resetPassword.titleRequest") : t("build.resetPassword.titleComplete")}
          </h1>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            {step === "request" ? (
              <>
                <p className="text-emerald-300 text-lg">✓ {t("build.resetPassword.emailSent")}</p>
                <p className="text-sm text-slate-400">
                  {t("build.resetPassword.checkInboxPrefix")} <strong>{email}</strong> {t("build.resetPassword.checkInboxSuffix")}
                </p>
              </>
            ) : (
              <>
                <p className="text-emerald-300 text-lg">✓ {t("build.resetPassword.passwordChanged")}</p>
                <p className="text-sm text-slate-400">{t("build.resetPassword.redirecting")}</p>
              </>
            )}
          </div>
        ) : step === "request" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-slate-400">
              {t("build.resetPassword.requestIntro")}
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label={t("build.resetPassword.emailPlaceholder")} placeholder="you@example.com"
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <div role="alert" aria-live="assertive">
              {err && <p className="text-sm text-rose-300">{err}</p>}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? t("build.resetPassword.sending") : t("build.resetPassword.sendLink")}
            </button>
            <div className="text-center text-xs text-slate-500">
              {t("build.resetPassword.rememberedPrompt")}{" "}
              <Link href="/build" className="text-emerald-400 hover:underline">
                {t("build.resetPassword.signInLink")}
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleComplete} className="space-y-4">
            <p className="text-sm text-slate-400">{t("build.resetPassword.completeIntro")}</p>
            {!initEmail && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("build.resetPassword.emailPlaceholder")}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            )}
            {!initToken && (
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder={t("build.resetPassword.tokenPlaceholder")}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            )}
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
              minLength={6}
              placeholder={t("build.resetPassword.newPasswordPlaceholder")}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <input
              type="password"
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              required
              placeholder={t("build.resetPassword.confirmPasswordPlaceholder")}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <div role="alert" aria-live="assertive">
              {err && <p className="text-sm text-rose-300">{err}</p>}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? t("build.resetPassword.saving") : t("build.resetPassword.savePassword")}
            </button>
            <button
              type="button"
              onClick={() => setStep("request")}
              className="w-full text-xs text-slate-500 hover:text-slate-300"
            >
              ← {t("build.resetPassword.requestNewLink")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
