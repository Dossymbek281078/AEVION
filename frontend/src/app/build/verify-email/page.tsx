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
  const [resendError, setResendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-submit if token came from URL (email link click)
  useEffect(() => {
    const t = params.get("token");
    if (t) {
      setToken(t);
      void verify(t, params.get("id") ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tokenId приходит из ссылки письма и позволяет завершить подтверждение БЕЗ
  // входа: человек чаще всего открывает письмо на телефоне, где сессии нет.
  async function verify(t: string, tokenId?: string) {
    setStatus("verifying");
    setMsg(null);
    try {
      await completeEmailVerification(t, tokenId);
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
                aria-label={t("build.verifyEmail.codePlaceholder")} placeholder={t("build.verifyEmail.codePlaceholder")}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                disabled={!token.trim() || status === "verifying"}
                onClick={() => verify(token.trim(), params.get("id") ?? undefined)}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {status === "verifying" ? "…" : t("build.verifyEmail.confirmButton")}
              </button>
            </div>

            {msg && (
              <p className="text-sm text-rose-300">
                {/*
                  Человеческий текст на ЛЮБУЮ ошибку, а не только на одну.

                  Раньше перевод стоял ровно на `invalid_or_expired_token`, а
                  всё остальное показывалось дословно от сервера. Замер на
                  проде 28.08.2026: по ссылке с устаревшим id человек видел
                  «отсутствует токен bearer» — это внутренний жаргон, и хуже
                  того, он намекает на вход, хотя вход здесь не нужен.

                  Для человека все эти ответы значат одно: ссылка не сработала,
                  запросите письмо заново. Поэтому показываем один понятный
                  текст, а технический код оставляем рядом мелким шрифтом —
                  чтобы поддержка могла спросить «что написано серым».
                */}
                {t("build.verifyEmail.invalidOrExpired")}
                {msg !== "invalid_or_expired_token" && (
                  <span className="ml-2 text-xs text-slate-500">({msg})</span>
                )}
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
                      const r = await requestEmailVerification();
                      // 200 не значит «письмо ушло»: у ответа для этого есть
                      // отдельное поле. Молчаливое «отправлено» стоило бы
                      // человеку ожидания письма, которого нет.
                      if (r.emailSent) setSent(true);
                      else setResendError(t("build.verifyEmail.notSent"));
                    } catch (e) {
                      // Пустой catch здесь означал ПОЛНУЮ тишину после нажатия:
                      // ни ошибки, ни подтверждения. Это хуже ошибки.
                      setResendError(e instanceof Error ? e.message : t("build.verifyEmail.notSent"));
                    }
                    finally { setSending(false); }
                  }}
                  className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                >
                  {sending ? t("build.verifyEmail.sending") : t("build.verifyEmail.resendButton")}
                </button>
              )}
            </div>

            {resendError && (
              // Сообщение обязано попасть НА ЭКРАН, а не только в состояние:
              // «правда доходит до переменной и не доходит до человека» —
              // ровно тот дефект, который здесь и чинится.
              <p className="text-xs text-amber-300" role="status">
                {resendError}
              </p>
            )}

            <Link href="/build" className="block text-xs text-slate-500 hover:text-slate-300">
              {t("build.verifyEmail.backHome")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
