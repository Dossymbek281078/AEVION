"use client";

import { useEffect, useRef, useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";
import { regionLabel, WORK_MODE_LABELS, EDUCATION_LEVEL_LABELS, type WorkMode, type EducationLevel } from "@/lib/build/geo";

type Turn = { role: "user" | "assistant"; content: string };

type Collected = {
  name?: string | null;
  title?: string | null;
  city?: string | null;
  region?: string | null;
  summary?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  workMode?: WorkMode | null;
  availabilityType?: "FULL_TIME" | "PART_TIME" | "PROJECT" | "SHIFT" | "REMOTE" | null;
  educationLevel?: EducationLevel | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
};

const OPENER = "Готов отвечать на вопросы для резюме.";

export function AiResumeBuilder({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collected, setCollected] = useState<Collected>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function step(next: Turn[]) {
    setError(null);
    setBusy(true);
    try {
      const r = await buildApi.aiResumeInterview(next);
      setTurns(r.question ? [...next, { role: "assistant", content: r.question }] : next);
      setCollected((r.collected ?? {}) as Collected);
      setIssues(r.issues ?? []);
      setDone(r.done);
    } catch (e) {
      const err = e as BuildApiError;
      setError(err.code || err.message || "AI failed");
      setTurns(turns);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setTurns([]);
    setCollected({});
    setIssues([]);
    setDone(false);
    setOpen(true);
    void step([{ role: "user", content: OPENER }]);
  }

  function send() {
    const content = input.trim();
    if (!content || busy || done) return;
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    void step(next);
  }

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      await buildApi.upsertProfile({
        name: String(collected.name || "(unnamed)"),
        title: collected.title ?? null,
        city: collected.city ?? null,
        region: collected.region ?? null,
        summary: collected.summary ?? null,
        skills: Array.isArray(collected.skills) ? collected.skills : undefined,
        experienceYears: typeof collected.experienceYears === "number" ? collected.experienceYears : undefined,
        workMode: collected.workMode ?? null,
        availabilityType: collected.availabilityType ?? null,
        educationLevel: collected.educationLevel ?? null,
        salaryMin: collected.salaryMin ?? null,
        salaryMax: collected.salaryMax ?? null,
        salaryCurrency: collected.salaryCurrency ?? null,
      });
      onApplied();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={start}
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
      >
        💬 Build resume by chatting with AI
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">AI resume interview</div>
          <div className="text-xs text-slate-400">
            Отвечай коротко — соберём резюме за 5-8 вопросов.
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close">
          ×
        </button>
      </div>

      <div ref={scrollRef} className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-white/5 bg-slate-900/40 p-3">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                t.role === "user" ? "bg-emerald-500 text-emerald-950" : "bg-white/5 text-slate-100"
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-500">Думаю…</p>}
      </div>

      {error && (
        <p className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {!done ? (
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Твой ответ… Enter — отправить."
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">✓ Готово</div>
            <button
              onClick={apply}
              disabled={applying}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {applying ? "Применяю…" : "Применить к профилю"}
            </button>
          </div>
          <CollectedSummary collected={collected} />
          {issues.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              ⚠ Проверено ИИ-валидатором: {issues.join("; ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CollectedSummary({ collected: c }: { collected: Collected }) {
  const lines: { label: string; value: string }[] = [];
  if (c.name) lines.push({ label: "Name", value: c.name });
  if (c.title) lines.push({ label: "Title", value: c.title });
  if (c.city) lines.push({ label: "City", value: `${c.city}${c.region ? `, ${regionLabel(c.region)}` : ""}` });
  if (c.experienceYears != null) lines.push({ label: "Experience", value: `${c.experienceYears}y` });
  if (Array.isArray(c.skills) && c.skills.length) lines.push({ label: "Skills", value: c.skills.join(", ") });
  if (c.workMode) lines.push({ label: "Work mode", value: WORK_MODE_LABELS[c.workMode] });
  if (c.educationLevel) lines.push({ label: "Education", value: EDUCATION_LEVEL_LABELS[c.educationLevel] });
  if (c.salaryMin || c.salaryMax)
    lines.push({
      label: "Salary",
      value: `${c.salaryMin ?? "—"}${c.salaryMax ? `–${c.salaryMax}` : ""} ${c.salaryCurrency || ""}`,
    });

  return (
    <dl className="space-y-1.5 text-xs">
      {lines.map((l) => (
        <div key={l.label} className="flex gap-3">
          <dt className="w-28 shrink-0 text-slate-500">{l.label}</dt>
          <dd className="text-slate-200">{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}
