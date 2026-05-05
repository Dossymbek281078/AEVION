"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { BuildShell } from "@/components/build/BuildShell";
import { useToast } from "@/components/build/Toast";
import { buildApi, type BuildApplication, type ApplicationLabel } from "@/lib/build/api";

const LABEL_OPTIONS: { key: ApplicationLabel; emoji: string; label: string }[] = [
  { key: "TOP_PICK", emoji: "⭐", label: "Top pick" },
  { key: "SHORTLIST", emoji: "📋", label: "Shortlist" },
  { key: "INTERVIEW", emoji: "💬", label: "Interview" },
  { key: "HOLD", emoji: "⏸", label: "Hold" },
];

export default function ApplicationReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string; appId: string }>();
  const vacancyId = params?.id as string;
  const initialAppId = params?.appId as string;
  const toast = useToast();

  const [applications, setApplications] = useState<BuildApplication[] | null>(null);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<{ id: string; body: string; isPinned: boolean; createdAt: string }[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [appList, v] = await Promise.all([
          buildApi.applicationsByVacancy(vacancyId),
          buildApi.getVacancy(vacancyId).catch(() => null),
        ]);
        if (cancelled) return;
        setApplications(appList.items);
        if (v) setVacancyTitle(v.title);
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vacancyId, toast]);

  const currentIdx = useMemo(() => {
    if (!applications) return -1;
    return applications.findIndex((a) => a.id === initialAppId);
  }, [applications, initialAppId]);

  const current = currentIdx >= 0 ? applications![currentIdx] : null;
  const prev = applications && currentIdx > 0 ? applications[currentIdx - 1] : null;
  const next = applications && currentIdx >= 0 && currentIdx < applications.length - 1 ? applications[currentIdx + 1] : null;

  // Load notes for current
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await buildApi.applicationNotes(current.id);
        if (!cancelled) setNotes(r.items);
      } catch {
        if (!cancelled) setNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  const goTo = useCallback(
    (appId: string) => {
      router.push(`/build/vacancy/${encodeURIComponent(vacancyId)}/review/${encodeURIComponent(appId)}`);
    },
    [router, vacancyId],
  );

  const setLabel = useCallback(
    async (label: ApplicationLabel | null) => {
      if (!current || busy) return;
      setBusy(true);
      const prevLabel = current.labelKey ?? null;
      // optimistic
      setApplications((items) =>
        items?.map((a) => (a.id === current.id ? { ...a, labelKey: label } : a)) ?? items,
      );
      try {
        await buildApi.setApplicationLabel(current.id, label);
        toast.success(label ? `Labeled: ${label}` : "Label cleared");
      } catch (e) {
        // rollback
        setApplications((items) =>
          items?.map((a) => (a.id === current.id ? { ...a, labelKey: prevLabel } : a)) ?? items,
        );
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, toast],
  );

  const setStatus = useCallback(
    async (status: "ACCEPTED" | "REJECTED") => {
      if (!current || busy) return;
      const reason = status === "REJECTED" ? prompt("Reject reason (optional):") || undefined : undefined;
      setBusy(true);
      try {
        await buildApi.updateApplication(current.id, status, reason);
        toast.success(status === "ACCEPTED" ? "Accepted" : "Rejected");
        // optimistic local update
        setApplications((items) =>
          items?.map((a) => (a.id === current.id ? { ...a, status } : a)) ?? items,
        );
        // auto-advance to next pending if any
        if (next) goTo(next.id);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, next, goTo, toast],
  );

  const addNote = useCallback(async () => {
    const body = noteDraft.trim();
    if (!current || !body) return;
    setNoteBusy(true);
    try {
      const note = await buildApi.addApplicationNote(current.id, body);
      setNotes((arr) => [{ id: note.id, body: note.body, isPinned: !!note.isPinned, createdAt: note.createdAt }, ...arr]);
      setNoteDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setNoteBusy(false);
    }
  }, [current, noteDraft, toast]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ignore when typing in inputs
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        goTo(prev.id);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        goTo(next.id);
      } else if (e.key === "a" && current?.status === "PENDING") {
        e.preventDefault();
        setStatus("ACCEPTED");
      } else if (e.key === "r" && current?.status === "PENDING") {
        e.preventDefault();
        setStatus("REJECTED");
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push(`/build/vacancy/${encodeURIComponent(vacancyId)}`);
      } else if (e.key === "1") {
        setLabel("TOP_PICK");
      } else if (e.key === "2") {
        setLabel("SHORTLIST");
      } else if (e.key === "3") {
        setLabel("INTERVIEW");
      } else if (e.key === "4") {
        setLabel("HOLD");
      } else if (e.key === "0") {
        setLabel(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, current, goTo, router, vacancyId, setLabel, setStatus]);

  if (!applications) {
    return (
      <BuildShell>
        <div className="text-sm text-slate-400">Loading review…</div>
      </BuildShell>
    );
  }
  if (!current) {
    return (
      <BuildShell>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Application not found in this vacancy.
          <div className="mt-3">
            <Link href={`/build/vacancy/${encodeURIComponent(vacancyId)}`} className="text-emerald-300 underline">
              ← Back to vacancy
            </Link>
          </div>
        </div>
      </BuildShell>
    );
  }

  return (
    <BuildShell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href={`/build/vacancy/${encodeURIComponent(vacancyId)}`}
          className="text-xs text-slate-400 underline-offset-2 hover:underline"
        >
          ← {vacancyTitle || "Back to vacancy"}
        </Link>
        <div className="text-xs text-slate-400">
          {currentIdx + 1} / {applications.length}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {current.applicantName || "Anonymous"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {current.applicantHeadline && <span>{current.applicantHeadline}</span>}
                {current.applicantCity && <span>📍 {current.applicantCity}</span>}
                {current.applicantExperienceYears != null && (
                  <span>{current.applicantExperienceYears}y exp</span>
                )}
                <span
                  className={
                    current.status === "ACCEPTED"
                      ? "rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200"
                      : current.status === "REJECTED"
                        ? "rounded bg-rose-500/15 px-2 py-0.5 text-rose-200"
                        : "rounded bg-amber-500/15 px-2 py-0.5 text-amber-200"
                  }
                >
                  {current.status}
                </span>
                {current.matchScore != null && (
                  <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-cyan-200">
                    match {Math.round(current.matchScore)}%
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/build/u/${encodeURIComponent(current.userId)}`}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              View profile →
            </Link>
          </div>

          {current.applicantSkills && current.applicantSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {current.applicantSkills.map((s) => (
                <span
                  key={s}
                  className={
                    current.matchedSkills?.includes(s)
                      ? "rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-100"
                      : "rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300"
                  }
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {current.message && (
            <div className="mt-5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cover message
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{current.message}</p>
            </div>
          )}

          {current.answers && current.answers.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Screening answers
              </div>
              <ol className="space-y-2 text-sm text-slate-200">
                {current.answers.map((a, i) => (
                  <li key={i} className="rounded-md border border-white/5 bg-black/20 p-3">
                    <div className="text-[11px] uppercase text-slate-500">Q{i + 1}</div>
                    <div className="mt-0.5 whitespace-pre-wrap">{a}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {current.aiScoreOverall != null && (
            <div className="mt-5 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100">
              <div className="text-xs font-semibold uppercase tracking-wider">AI score</div>
              <div className="mt-0.5 text-lg font-semibold">{current.aiScoreOverall}/100</div>
            </div>
          )}

          {/* nav buttons */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && goTo(prev.id)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              ← Previous (←)
            </button>
            <div className="flex gap-2">
              {current.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus("ACCEPTED")}
                    disabled={busy}
                    className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
                  >
                    ✓ Accept (a)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("REJECTED")}
                    disabled={busy}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    ✗ Reject (r)
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && goTo(next.id)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              Next (→) →
            </button>
          </div>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Label
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((opt, i) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLabel(opt.key)}
                  className={
                    current.labelKey === opt.key
                      ? "rounded-md border border-emerald-400/50 bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                      : "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                  }
                  title={`Hotkey: ${i + 1}`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLabel(null)}
                className="rounded-md border border-white/10 bg-transparent px-2.5 py-1 text-xs text-slate-400 transition hover:text-slate-200"
                title="Hotkey: 0"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Notes ({notes.length})
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Quick note for your team…"
              rows={3}
              className="mb-2 w-full rounded-md border border-white/10 bg-black/30 p-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={addNote}
              disabled={!noteDraft.trim() || noteBusy}
              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
            >
              {noteBusy ? "…" : "Add note"}
            </button>
            {notes.length > 0 && (
              <ul className="mt-3 space-y-2">
                {notes.slice(0, 8).map((n) => (
                  <li key={n.id} className="rounded-md border border-white/5 bg-black/20 p-2 text-xs text-slate-300">
                    <div className="whitespace-pre-wrap">{n.body}</div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.isPinned ? " · 📌 pinned" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Shortcuts
            </div>
            <ul className="space-y-1 text-[11px] text-slate-400">
              <li><kbd className="rounded bg-white/10 px-1">←</kbd> / <kbd className="rounded bg-white/10 px-1">→</kbd> prev/next</li>
              <li><kbd className="rounded bg-white/10 px-1">a</kbd> accept · <kbd className="rounded bg-white/10 px-1">r</kbd> reject</li>
              <li><kbd className="rounded bg-white/10 px-1">1-4</kbd> set label · <kbd className="rounded bg-white/10 px-1">0</kbd> clear</li>
              <li><kbd className="rounded bg-white/10 px-1">Esc</kbd> back</li>
            </ul>
          </div>
        </div>
      </div>
    </BuildShell>
  );
}
