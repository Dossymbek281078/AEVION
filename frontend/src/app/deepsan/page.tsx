"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import StatsBar from "./components/StatsBar";
import TaskCard, { type Task, type Priority } from "./components/TaskCard";
import AddTaskForm from "./components/AddTaskForm";
import FocusTimer from "./components/FocusTimer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalTasks: number;
  doneTasks: number;
  totalFocusMin: number;
  streakDays: number;
}

interface ApiOk<T> {
  success: true;
  data: T;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...opts,
    headers: { "content-type": "application/json", ...opts?.headers },
  });
  const json = (await res.json()) as ApiOk<T> | { success: false; error: string };
  if (!json.success) throw new Error((json as { success: false; error: string }).error ?? "api error");
  return (json as ApiOk<T>).data;
}

// ─── Column helpers ───────────────────────────────────────────────────────────

function columnTasks(tasks: Task[], col: "todo" | "inprogress" | "done"): Task[] {
  if (col === "done") return tasks.filter((t) => t.done);
  if (col === "inprogress") return tasks.filter((t) => !t.done && t.priority === "critical");
  return tasks.filter((t) => !t.done && t.priority !== "critical");
}

const COL_LABELS: Record<"todo" | "inprogress" | "done", string> = {
  todo: "Todo",
  inprogress: "In Progress",
  done: "Done",
};

const COL_ACCENT: Record<"todo" | "inprogress" | "done", string> = {
  todo: "#94a3b8",
  inprogress: "#f97316",
  done: "#22c55e",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeepSanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [activeFocusId, setActiveFocusId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  // ── Fetch tasks ────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await apiFetch<Task[]>("/api/deepsan/tasks?limit=100");
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // ── Fetch stats ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await apiFetch<Stats>("/api/deepsan/stats");
      setStats(data);
    } catch {
      // stats are non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Fetch active focus session ─────────────────────────────────────────────

  const loadActiveSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ id: number } | null>("/api/deepsan/focus/active");
      setActiveFocusId(data ? data.id : null);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadStats();
    loadActiveSession();
  }, [loadTasks, loadStats, loadActiveSession]);

  // ── Add task ───────────────────────────────────────────────────────────────

  async function handleAddTask(payload: {
    title: string;
    description?: string;
    priority: Priority;
    dueDate?: string;
    tags?: string[];
  }) {
    setAddBusy(true);
    setError(null);
    try {
      const task = await apiFetch<Task>("/api/deepsan/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTasks((prev) => [task, ...prev]);
      loadStats();
      showToast("Task added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add task");
    } finally {
      setAddBusy(false);
    }
  }

  // ── Toggle done ────────────────────────────────────────────────────────────

  async function handleToggleDone(id: number, done: boolean) {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try {
      await apiFetch<Task>(`/api/deepsan/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      });
      loadStats();
    } catch (e) {
      // revert
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !done } : t)));
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  async function handleDeleteTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await apiFetch<{ deleted: number }>(`/api/deepsan/tasks/${id}`, { method: "DELETE" });
      loadStats();
      showToast("Task deleted");
    } catch (e) {
      loadTasks(); // re-fetch to restore
      setError(e instanceof Error ? e.message : "Failed to delete task");
    }
  }

  // ── Start focus ────────────────────────────────────────────────────────────

  async function handleStartFocus(durationMin: number, taskId: number | null): Promise<number | null> {
    try {
      const session = await apiFetch<{ id: number }>("/api/deepsan/focus", {
        method: "POST",
        body: JSON.stringify({ taskId, durationMin }),
      });
      setActiveFocusId(session.id);
      showToast(`Focus session started (${durationMin} min)`);
      return session.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start focus session");
      return null;
    }
  }

  // ── Complete focus ─────────────────────────────────────────────────────────

  async function handleCompleteFocus(sessionId: number, actualMin: number): Promise<void> {
    try {
      await apiFetch(`/api/deepsan/focus/${sessionId}/done`, {
        method: "PATCH",
        body: JSON.stringify({ actualDurationMin: actualMin }),
      });
      setActiveFocusId(null);
      loadStats();
      showToast(`Focus session complete! ${actualMin} min logged.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete session");
    }
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  const cols: Array<"todo" | "inprogress" | "done"> = ["todo", "inprogress", "done"];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #0a0f1e 100%)",
        color: "#e2e8f0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid rgba(249,115,22,0.12)",
          background: "rgba(10,15,30,0.85)",
          backdropFilter: "blur(12px)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{ color: "#fed7aa", textDecoration: "none", fontSize: "13px" }}
        >
          ← AEVION · DeepSan
        </Link>
        <div style={{ display: "flex", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#f97316",
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: "6px",
              padding: "3px 8px",
            }}
          >
            Anti-chaos MVP
          </span>
        </div>
      </header>

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#f97316",
              marginBottom: "8px",
            }}
          >
            Productivity · Focus · Anti-chaos
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 800,
              color: "#f1f5f9",
              margin: "0 0 8px 0",
              lineHeight: 1.15,
            }}
          >
            Structure your chaos.{" "}
            <span style={{ color: "#f97316" }}>Ship what matters.</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "560px", margin: 0 }}>
            Tasks as states + deep focus sessions. No noise, no overwhelm.
          </p>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} loading={statsLoading} />

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "#fca5a5",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: "#fca5a5",
                cursor: "pointer",
                fontSize: "16px",
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Main layout: Kanban + Timer */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* Kanban */}
          <div>
            <AddTaskForm onAdd={handleAddTask} busy={addBusy} />
            {tasksLoading ? (
              <div style={{ color: "#475569", fontSize: "13px", padding: "20px 0" }}>
                Loading tasks…
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                }}
              >
                {cols.map((col) => {
                  const colTasks = columnTasks(tasks, col);
                  return (
                    <div key={col}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "12px",
                          paddingBottom: "8px",
                          borderBottom: `2px solid ${COL_ACCENT[col]}33`,
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: COL_ACCENT[col],
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: COL_ACCENT[col],
                          }}
                        >
                          {COL_LABELS[col]}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#475569",
                            marginLeft: "auto",
                          }}
                        >
                          {colTasks.length}
                        </span>
                      </div>
                      {colTasks.length === 0 ? (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#334155",
                            textAlign: "center",
                            padding: "20px 0",
                            border: "1px dashed rgba(148,163,184,0.08)",
                            borderRadius: "8px",
                          }}
                        >
                          empty
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleDone={handleToggleDone}
                            onDelete={handleDeleteTask}
                            onStartFocus={(id) => {
                              setFocusTaskId(id);
                              showToast("Task selected for focus. Press Start Focus.");
                            }}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Focus Timer */}
          <div style={{ position: "sticky", top: "72px" }}>
            {focusTaskId !== null && (
              <div
                style={{
                  background: "rgba(249,115,22,0.08)",
                  border: "1px solid rgba(249,115,22,0.2)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "#fed7aa",
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Task #{focusTaskId} selected</span>
                <button
                  onClick={() => setFocusTaskId(null)}
                  style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontSize: "14px", padding: 0 }}
                >
                  ×
                </button>
              </div>
            )}
            <FocusTimer
              activeFocusId={activeFocusId}
              onStart={handleStartFocus}
              onComplete={handleCompleteFocus}
              taskId={focusTaskId}
            />

            {/* Quick links */}
            <div
              style={{
                marginTop: "16px",
                background: "rgba(15,23,42,0.5)",
                border: "1px solid rgba(148,163,184,0.08)",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#475569", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                AEVION modules
              </div>
              {[
                { href: "/qcoreai", label: "QCoreAI", desc: "AI agent engine" },
                { href: "/multichat-engine", label: "Multichat", desc: "Inbox action items" },
                { href: "/qpersona", label: "QPersona", desc: "AI twin" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "block",
                    padding: "8px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    marginBottom: "4px",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#f97316" }}>{link.label} →</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>{link.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(249,115,22,0.3)",
            borderRadius: "10px",
            padding: "10px 20px",
            fontSize: "13px",
            color: "#fed7aa",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
