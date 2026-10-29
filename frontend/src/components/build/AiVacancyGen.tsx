"use client";

import { useState } from "react";
import { buildApi, type AiVacancyDraft } from "@/lib/build/api";
import { regionLabelIn, workModeLabelIn, educationLabelIn } from "@/lib/build/geo";
import { useBuildT } from "@/app/build/i18n";

export function AiVacancyGen({
  city,
  onApply,
}: {
  city?: string | null;
  onApply: (draft: AiVacancyDraft) => void;
}) {
  const { t, lang, num } = useBuildT();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiVacancyDraft | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
      >
        {t("gen.open")}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">{t("gen.heading")}</span>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("gen.closeAria")} className="text-xs text-slate-400 hover:text-slate-200">×</button>
      </div>
      <p className="text-xs text-slate-400">
        {t("gen.intro")}
      </p>
      <div className="flex gap-2">
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t("gen.ph")}
          aria-label={t("gen.briefAria")}
          className="flex-1 rounded-md border border-white/10 bg-black/30 p-2 text-white placeholder:text-slate-500"
        />
        <button
          type="button"
          disabled={busy || brief.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const r = await buildApi.aiGenerateVacancy({ brief: brief.trim(), city });
              setDraft(r.draft);
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "…" : t("gen.go")}
        </button>
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}

      {draft && (
        <div className="space-y-2 rounded-md border border-white/10 bg-black/30 p-3 text-xs">
          <div>
            <div className="text-slate-400">{t("gen.title")}</div>
            <div className="font-semibold text-white">{draft.title}</div>
          </div>
          <div>
            <div className="text-slate-400">{t("gen.skills")}</div>
            <div className="flex flex-wrap gap-1">
              {draft.skills.map((s, i) => (
                <span key={i} className="rounded-full bg-white/5 px-2 py-0.5">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-slate-400">{t("gen.desc")}</div>
            <p className="whitespace-pre-wrap text-slate-200">{draft.description}</p>
          </div>
          {(draft.salaryMin != null || draft.salaryMax != null) && (
            <div>
              <div className="text-slate-400">{t("gen.salary")}</div>
              <div className="text-white">
                {draft.salaryMin != null ? num(draft.salaryMin) : "?"} — {draft.salaryMax != null ? num(draft.salaryMax) : "?"} {draft.salaryCurrency}
              </div>
            </div>
          )}
          {(draft.region || draft.workMode || draft.minExperienceYears != null || draft.educationLevel) && (
            <div>
              <div className="text-slate-400">{t("gen.reqs")}</div>
              <div className="flex flex-wrap gap-2 text-white">
                {draft.region && <span>📍 {regionLabelIn(draft.region, lang)}</span>}
                {draft.workMode && <span>{workModeLabelIn(draft.workMode, lang)}</span>}
                {draft.minExperienceYears != null && <span>{t("gen.fromExp", { n: draft.minExperienceYears })}</span>}
                {draft.educationLevel && <span>🎓 {educationLabelIn(draft.educationLevel, lang)}</span>}
              </div>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => { onApply(draft); setOpen(false); setDraft(null); setBrief(""); }}
              className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              {t("gen.apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
