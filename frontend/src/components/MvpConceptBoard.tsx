"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Item = {
  id: string;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
};

type Stats = {
  total: number;
  last7d: number;
  topTags: Array<{ tag: string; count: number }>;
};

export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number";
  placeholder?: string;
  required?: boolean;
};

export type MvpConceptBoardProps = {
  moduleId: string;
  noun: string;
  fields: FieldSpec[];
  titleField: string;
  summaryField?: string;
  sectionTitle: string;
  sectionHint?: string;
  accent?: "emerald" | "sky" | "violet" | "amber" | "rose" | "teal";
};

const ACCENTS: Record<NonNullable<MvpConceptBoardProps["accent"]>, {
  ring: string; bg: string; text: string; btn: string; chip: string;
}> = {
  emerald: { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-300", btn: "bg-emerald-500 hover:bg-emerald-400 text-slate-900", chip: "bg-emerald-500/15 text-emerald-200" },
  sky:     { ring: "ring-sky-500/40",     bg: "bg-sky-500/10",     text: "text-sky-300",     btn: "bg-sky-500 hover:bg-sky-400 text-slate-900",         chip: "bg-sky-500/15 text-sky-200" },
  violet:  { ring: "ring-violet-500/40",  bg: "bg-violet-500/10",  text: "text-violet-300",  btn: "bg-violet-500 hover:bg-violet-400 text-slate-900",   chip: "bg-violet-500/15 text-violet-200" },
  amber:   { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-300",   btn: "bg-amber-500 hover:bg-amber-400 text-slate-900",     chip: "bg-amber-500/15 text-amber-200" },
  rose:    { ring: "ring-rose-500/40",    bg: "bg-rose-500/10",    text: "text-rose-300",    btn: "bg-rose-500 hover:bg-rose-400 text-slate-900",       chip: "bg-rose-500/15 text-rose-200" },
  teal:    { ring: "ring-teal-500/40",    bg: "bg-teal-500/10",    text: "text-teal-300",    btn: "bg-teal-500 hover:bg-teal-400 text-slate-900",       chip: "bg-teal-500/15 text-teal-200" },
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const d = Math.max(0, Date.now() - t);
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function MvpConceptBoard({
  moduleId,
  noun,
  fields,
  titleField,
  summaryField,
  sectionTitle,
  sectionHint,
  accent = "emerald",
}: MvpConceptBoardProps) {
  const colors = ACCENTS[accent];
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(apiUrl(`/api/${moduleId}/${noun}?limit=5`), { cache: "no-store" }),
        fetch(apiUrl(`/api/${moduleId}/concept-stats`), { cache: "no-store" }),
      ]);
      if (listRes.ok) {
        const j = await listRes.json();
        setItems(Array.isArray(j.items) ? j.items : []);
      }
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats({
          total: Number(s.total ?? 0),
          last7d: Number(s.last7d ?? 0),
          topTags: Array.isArray(s.topTags) ? s.topTags : [],
        });
      }
    } catch {
      /* network drop — keep prior state */
    } finally {
      setLoading(false);
    }
  }, [moduleId, noun]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      const missing = fields
        .filter((f) => f.required !== false && !draft[f.key]?.trim())
        .map((f) => f.label);
      if (missing.length > 0) {
        setErr(`Заполните: ${missing.join(", ")}`);
        return;
      }
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {};
        for (const f of fields) {
          const v = draft[f.key]?.trim() ?? "";
          if (!v) continue;
          payload[f.key] = f.type === "number" ? Number(v) : v;
        }
        const r = await fetch(apiUrl(`/api/${moduleId}/${noun}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setErr(j.error || `HTTP ${r.status}`);
          return;
        }
        setDraft(Object.fromEntries(fields.map((f) => [f.key, ""])));
        await refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "submit_failed");
      } finally {
        setSubmitting(false);
      }
    },
    [draft, fields, moduleId, noun, refresh],
  );

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {sectionTitle}
          </h2>
          {sectionHint && (
            <p className="mt-1 text-xs text-slate-500">{sectionHint}</p>
          )}
        </div>
        {stats && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-medium ${colors.chip}`}>
              total · {stats.total}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${colors.chip}`}>
              7d · {stats.last7d}
            </span>
            {stats.topTags.slice(0, 3).map((t) => (
              <span key={t.tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
                #{t.tag} · {t.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form
          onSubmit={submit}
          className={`rounded-2xl border border-slate-800 ${colors.bg} p-5 ring-1 ${colors.ring}`}
        >
          <h3 className={`mb-3 text-sm font-semibold ${colors.text}`}>＋ Поделиться</h3>
          <div className="space-y-2.5">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {f.label}
                  {f.required !== false && <span className="ml-1 text-rose-400">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>
          {err && (
            <p className="mt-3 rounded-md bg-rose-500/15 px-3 py-1.5 text-xs text-rose-300 ring-1 ring-rose-500/40">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${colors.btn}`}
          >
            {submitting ? "Отправляем…" : "Отправить"}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Последние</h3>
          {loading && items.length === 0 ? (
            <p className="text-xs text-slate-500">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-500">
              Пока пусто. Стань первым, кто поделится.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {items.map((it) => {
                const title = String(it.payload[titleField] ?? "(без названия)");
                const summary = summaryField
                  ? String(it.payload[summaryField] ?? "")
                  : "";
                return (
                  <li
                    key={it.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-100">{title}</p>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        {timeAgo(it.createdAt)}
                      </span>
                    </div>
                    {summary && (
                      <p className="text-xs leading-relaxed text-slate-400">
                        {summary.length > 180 ? summary.slice(0, 180) + "…" : summary}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
