"use client";

import { useEffect, useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { AiImprove } from "@/components/build/AiImprove";
import { useToast } from "@/components/build/Toast";
import { deriveApplySource, deriveReferrerUserId } from "@/lib/build/applySource";
import { useBuildT } from "@/app/build/i18n";

export function ApplicationForm({
  vacancyId,
  alreadyApplied,
  questions,
  onApplied,
}: {
  vacancyId: string;
  alreadyApplied?: boolean;
  questions?: string[];
  onApplied?: () => void;
}) {
  const token = useBuildAuth((s) => s.token);
  const toast = useToast();
  const { t, lang } = useBuildT();
  const [message, setMessage] = useState("");
  const qs = questions || [];
  const [answers, setAnswers] = useState<string[]>(() => qs.map(() => ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function generateCoverLetter() {
    setAiBusy(true);
    try {
      const r = await buildApi.aiCoverLetter({ vacancyId, locale: lang === "ru" ? "ru" : lang === "kk" ? "kz" : "en" });
      setMessage(r.coverLetter);
      if ((r.skillsOverlap || []).length > 0) {
        toast.success(t("form.drafted", { list: (r.skillsOverlap || []).slice(0, 3).join(", ") }));
      } else {
        toast.info(t("form.draftReady"));
      }
    } catch (e) {
      const err = e as BuildApiError;
      if (err.code === "profile_required_for_ai_cover_letter") {
        toast.error(t("form.profileFirst"));
      } else {
        toast.error(err.message);
      }
    } finally {
      setAiBusy(false);
    }
  }

  // Read ?ref=<userId> from URL once on mount to attribute applications
  // back to whoever shared the vacancy link. Falls back to localStorage
  // (30d TTL) so a candidate who lands on /build/r/<userId> first and
  // applies later still gets attributed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = deriveReferrerUserId();
    if (ref) setReferredBy(ref);
  }, []);

  if (!token) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        {t("form.signIn")}
      </div>
    );
  }

  if (alreadyApplied || success) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        {t("form.submitted")}
        {qs.length > 0 && (
          <div className="mt-1 text-xs text-emerald-200/80">
            {t("form.scoring")}
          </div>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await buildApi.apply({
        vacancyId,
        message: message.trim() || undefined,
        answers: qs.length > 0 ? answers.map((a) => a.trim()) : undefined,
        referredByUserId: referredBy || undefined,
        sourceTag: deriveApplySource(),
      });
      setSuccess(true);
      onApplied?.();
    } catch (err) {
      const e = err as BuildApiError;
      setError(e.code === "already_applied" ? t("form.already") : e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium text-slate-200">
        <span className="flex items-center justify-between gap-2">
          <span>{t("form.cover")}</span>
          <button
            type="button"
            onClick={generateCoverLetter}
            disabled={aiBusy}
            className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
            title={t("form.genTitle")}
          >
            {aiBusy ? t("form.drafting") : t("form.gen")}
          </button>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={t("form.coverPh")}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
      </label>
      <AiImprove
        value={message}
        onAccept={(v) => setMessage(v)}
        kind="cover_note"
        hint={t("form.improveHint")}
      />
      {qs.length > 0 && (
        <div className="space-y-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">
            {t("form.questions")}
          </div>
          {qs.map((q, i) => (
            <label key={i} className="block text-xs text-slate-200">
              <span className="font-semibold text-fuchsia-100">Q{i + 1}.</span> {q}
              <textarea
                value={answers[i] || ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                rows={2}
                maxLength={2000}
                placeholder={t("form.answerPh")}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 p-2 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none"
              />
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? t("form.submitting") : t("form.submit")}
      </button>
    </form>
  );
}
