"use client";

import { useState } from "react";
import { buildApi, type AiVacancyDraft } from "@/lib/build/api";

export function AiVacancyGen({
  city,
  onApply,
}: {
  city?: string | null;
  onApply: (draft: AiVacancyDraft) => void;
}) {
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
        🤖 Сгенерировать с AI
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">🤖 AI Vacancy Generator</span>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">×</button>
      </div>
      <p className="text-xs text-slate-400">
        Опиши вакансию одной строкой — AI вернёт черновик с задачами, навыками и зарплатой.
      </p>
      <div className="flex gap-2">
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder='Например: "Ищу сварщика 5 разряда на 2 месяца, аргон, монтаж металлоконструкций"'
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
          {busy ? "…" : "Сгенерировать"}
        </button>
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}

      {draft && (
        <div className="space-y-2 rounded-md border border-white/10 bg-black/30 p-3 text-xs">
          <div>
            <div className="text-slate-400">Title:</div>
            <div className="font-semibold text-white">{draft.title}</div>
          </div>
          <div>
            <div className="text-slate-400">Skills:</div>
            <div className="flex flex-wrap gap-1">
              {draft.skills.map((s, i) => (
                <span key={i} className="rounded-full bg-white/5 px-2 py-0.5">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Description:</div>
            <p className="whitespace-pre-wrap text-slate-200">{draft.description}</p>
          </div>
          {(draft.salaryMin != null || draft.salaryMax != null) && (
            <div>
              <div className="text-slate-400">Зарплата:</div>
              <div className="text-white">
                {draft.salaryMin?.toLocaleString("ru-RU") || "?"} — {draft.salaryMax?.toLocaleString("ru-RU") || "?"} {draft.salaryCurrency}
              </div>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => { onApply(draft); setOpen(false); setDraft(null); setBrief(""); }}
              className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Подставить в форму →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
