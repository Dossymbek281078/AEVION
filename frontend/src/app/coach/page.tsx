"use client";

// AEVION Coach — student dashboard.
//
// Two surfaces stacked on the page:
//   1) Live coaching session card — start a session (topic + optional FEN),
//      see elapsed time tick, end it with notes.
//   2) Goal tracker — create goals, optionally linked to the active session,
//      mark complete, delete, filter by status.
//
// All requests pass an opaque `clientId` (stored in localStorage) so an
// anonymous student keeps their data across reloads. When a Bearer token
// is wired up, the backend prefers it over clientId.

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Session = {
  id: string;
  topic: string;
  startingFen?: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  notes?: string;
  messageCount: number;
  goalsLinked: string[];
};

type Goal = {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  sessionId?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
};

// ─── ClientId helper (stable per browser) ────────────────────────────────────
function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "aevion.coach.clientId";
  let v = window.localStorage.getItem(KEY);
  if (!v) {
    v = `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, v);
  }
  return v;
}

// ─── Time helpers ────────────────────────────────────────────────────────────
function formatElapsed(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m ${s}s`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CoachPage() {
  const [clientId, setClientId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces re-render for live timer

  // Session form state
  const [topic, setTopic] = useState("");
  const [startingFen, setStartingFen] = useState("");
  const [endingNotes, setEndingNotes] = useState("");

  // Goal form state
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalFilter, setGoalFilter] = useState<"all" | "open" | "done">("open");

  // ── init clientId + load data ───────────────────────────────────────────
  useEffect(() => {
    setClientId(getOrCreateClientId());
  }, []);

  useEffect(() => {
    if (!clientId) return;
    void refreshAll();
    // Tick the live timer once a second while an active session exists.
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function refreshAll() {
    setError(null);
    setLoading(true);
    try {
      const cidQs = encodeURIComponent(clientId);
      const [sRes, gRes] = await Promise.all([
        fetch(apiUrl(`/api/coach/sessions?clientId=${cidQs}`)),
        fetch(apiUrl(`/api/coach/goals?clientId=${cidQs}`)),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setSessions(Array.isArray(data.items) ? data.items : []);
        const open = (data.items as Session[] | undefined)?.find((s) => !s.endedAt) ?? null;
        setActiveSession(open);
      }
      if (gRes.ok) {
        const data = await gRes.json();
        setGoals(Array.isArray(data.items) ? data.items : []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // Helper: list sessions/goals scoped via clientId echo. Because GET endpoints
  // don't read a body, we POST a no-op start that fails validation but
  // registers the owner — wasteful. Instead, do: when we create anything the
  // server responds with that single record; we splice it locally. The
  // page-load GET fetches the "anon" bucket on cold start.
  //
  // Practical UX: after the first start/create call, we drop the cold-start
  // anon list and rebuild from local state.

  async function startSession() {
    setError(null);
    const t = topic.trim();
    if (!t) {
      setError("Topic is required");
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/coach/sessions/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: t,
          startingFen: startingFen.trim() || undefined,
          clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");
      const s = data.session as Session;
      setActiveSession(s);
      setSessions((prev) => [s, ...prev]);
      setTopic("");
      setStartingFen("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    }
  }

  async function endSession() {
    if (!activeSession) return;
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/coach/sessions/${activeSession.id}/end`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: endingNotes.trim() || undefined,
          clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to end session");
      const ended = data.session as Session;
      setSessions((prev) => prev.map((s) => (s.id === ended.id ? ended : s)));
      setActiveSession(null);
      setEndingNotes("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to end session");
    }
  }

  async function createGoal() {
    setError(null);
    const t = goalTitle.trim();
    if (!t) {
      setError("Goal title is required");
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/coach/goals`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: goalDescription.trim() || undefined,
          targetDate: goalTargetDate || undefined,
          sessionId: activeSession?.id,
          clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create goal");
      const g = data.goal as Goal;
      setGoals((prev) => [g, ...prev]);
      setGoalTitle("");
      setGoalDescription("");
      setGoalTargetDate("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create goal");
    }
  }

  async function completeGoal(id: string) {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/coach/goals/${id}/complete`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete goal");
      const g = data.goal as Goal;
      setGoals((prev) => prev.map((x) => (x.id === g.id ? g : x)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to complete goal");
    }
  }

  async function deleteGoal(id: string) {
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/coach/goals/${id}?clientId=${encodeURIComponent(clientId)}`),
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete goal");
      }
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete goal");
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const visibleGoals = useMemo(() => {
    return goals.filter((g) =>
      goalFilter === "all" ? true : goalFilter === "done" ? g.completed : !g.completed,
    );
  }, [goals, goalFilter]);

  const completedCount = goals.filter((g) => g.completed).length;
  const totalSessions = sessions.length;
  const totalSecCoached = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const liveElapsed = activeSession ? formatElapsed(activeSession.startedAt) : null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick; // touch tick so React knows to re-render every second

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/80">AEVION · Coach</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Your coaching workspace
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Track live coaching sessions and the goals you set during them. All data is
            scoped to this browser until you sign in.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* ─── Stats strip ─────────────────────────────────────────────── */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Sessions" value={totalSessions} />
          <StatCard
            label="Coached time"
            value={`${Math.floor(totalSecCoached / 60)}m`}
          />
          <StatCard
            label="Goals"
            value={`${completedCount} / ${goals.length}`}
            hint="completed"
          />
          <StatCard
            label="Status"
            value={activeSession ? "Live" : "Idle"}
            hint={activeSession ? liveElapsed ?? undefined : undefined}
            accent={activeSession ? "live" : undefined}
          />
        </section>

        {/* ─── Active / start session card ──────────────────────────── */}
        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
          <h2 className="text-lg font-semibold">
            {activeSession ? "Live session" : "Start a session"}
          </h2>

          {activeSession ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  in progress
                </span>
                <div className="font-mono text-2xl tabular-nums text-cyan-300">
                  {liveElapsed}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Row label="Topic" value={activeSession.topic} />
                {activeSession.startingFen && (
                  <Row label="Starting FEN" value={activeSession.startingFen} mono />
                )}
                <Row label="Started" value={shortDate(activeSession.startedAt)} />
                <Row
                  label="Linked goals"
                  value={
                    activeSession.goalsLinked.length === 0
                      ? "none"
                      : String(activeSession.goalsLinked.length)
                  }
                />
              </div>
              <div className="mt-5 space-y-3">
                <textarea
                  value={endingNotes}
                  onChange={(e) => setEndingNotes(e.target.value)}
                  placeholder="Notes to wrap up (what was covered, takeaways, blunders to revisit)…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={endSession}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-400 active:translate-y-px"
                >
                  End session
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic (e.g. King's Indian endgame technique)"
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <input
                value={startingFen}
                onChange={(e) => setStartingFen(e.target.value)}
                placeholder="Starting FEN (optional)"
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={startSession}
                className="self-start rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition hover:bg-cyan-400 active:translate-y-px"
              >
                Start session
              </button>
            </div>
          )}
        </section>

        {/* ─── Goal tracker ─────────────────────────────────────────── */}
        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Goals</h2>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/60 p-0.5 text-xs">
              {(["open", "done", "all"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setGoalFilter(f)}
                  className={`rounded-md px-3 py-1 transition ${
                    goalFilter === f
                      ? "bg-cyan-500 font-semibold text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="New goal (e.g. Convert R+P endgames cleanly)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <input
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={goalTargetDate}
                onChange={(e) => setGoalTargetDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={createGoal}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 active:translate-y-px"
              >
                Add
              </button>
            </div>
          </div>

          {activeSession && (
            <p className="mt-2 text-xs text-slate-500">
              New goals will be linked to the active session.
            </p>
          )}

          <ul className="mt-5 space-y-2">
            {visibleGoals.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
                No goals yet. Add one above to start tracking.
              </li>
            )}
            {visibleGoals.map((g) => (
              <li
                key={g.id}
                className={`flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 transition ${
                  g.completed
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => !g.completed && completeGoal(g.id)}
                  disabled={g.completed}
                  aria-label={g.completed ? "Completed" : "Mark complete"}
                  className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border transition ${
                    g.completed
                      ? "border-emerald-400 bg-emerald-400 text-slate-950"
                      : "border-slate-600 hover:border-cyan-400"
                  }`}
                >
                  {g.completed && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mx-auto h-4 w-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.3-6.3a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      g.completed ? "text-slate-400 line-through" : "text-slate-100"
                    }`}
                  >
                    {g.title}
                  </div>
                  {g.description && (
                    <div className="mt-0.5 text-xs text-slate-500">{g.description}</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>created {shortDate(g.createdAt)}</span>
                    {g.targetDate && <span>target {g.targetDate.slice(0, 10)}</span>}
                    {g.sessionId && <span>session #{g.sessionId.slice(0, 8)}</span>}
                    {g.completedAt && <span>done {shortDate(g.completedAt)}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGoal(g.id)}
                  aria-label="Delete goal"
                  className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M6 7h8l-.7 9.1a2 2 0 01-2 1.9H8.7a2 2 0 01-2-1.9L6 7zM4 5h12v1H4V5zm4-2h4a1 1 0 011 1v1H7V4a1 1 0 011-1z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Recent sessions ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <ul className="mt-4 space-y-2">
            {sessions.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
                {loading ? "Loading…" : "No sessions yet."}
              </li>
            )}
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{s.topic}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {shortDate(s.startedAt)}
                    {s.endedAt && (
                      <>
                        {" "}
                        · {formatElapsed(s.startedAt, s.endedAt)}
                      </>
                    )}
                    {s.goalsLinked.length > 0 && <> · {s.goalsLinked.length} goals</>}
                  </div>
                  {s.notes && (
                    <div className="mt-1 text-xs italic text-slate-400">“{s.notes}”</div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    s.endedAt
                      ? "bg-slate-800 text-slate-400"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {s.endedAt ? "ended" : "live"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "live";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent === "live"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-100 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span
        className={`break-all text-sm text-slate-200 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
