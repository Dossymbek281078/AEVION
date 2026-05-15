"use client";

import { useState } from "react";
import { buildApi } from "@/lib/build/api";

type Kind = "summary" | "vacancy_description" | "cover_note" | "experience" | "generic";

// Floating ✨ button that calls /api/build/ai/improve-text and lets the
// user preview the rewrite vs the original before applying. Renders as
// a thin row above the textarea — drop it next to any field you want to
// AI-polish.
export function AiImprove({
  value,
  onAccept,
  kind = "generic",
  locale = "ru",
  hint,
}: {
  value: string;
  onAccept: (next: string) => void;
  kind?: Kind;
  locale?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [improved, setImproved] = useState<string | null>(null);

  async function run() {
    if (!value || value.trim().length < 10) {
      setError("Минимум 10 символов для улучшения");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await buildApi.aiImproveText({ text: value, kind, locale });
      setImproved(r.improved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (improved != null) {
    return (
      <div className="space-y-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs">
        <div className="font-semibold uppercase tracking-wider text-fuchsia-200">
          ✨ AI-вариант (Claude). Сравните, прежде чем применить.
        </div>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-2 font-sans text-slate-100">
          {improved}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onAccept(improved);
              setImproved(null);
            }}
            className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-fuchsia-950 hover:bg-fuchsia-400"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={() => setImproved(null)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              setImproved(null);
              run();
            }}
            disabled={busy}
            className="rounded-md border border-fuchsia-500/40 px-3 py-1.5 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10"
          >
            ⟳ Ещё вариант
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{hint || "Claude может переписать конкретнее"}</span>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
      >
        {busy ? "✨ …" : "✨ Улучшить с AI"}
      </button>
      {error && <span className="text-rose-300">{error}</span>}
    </div>
  );
}
