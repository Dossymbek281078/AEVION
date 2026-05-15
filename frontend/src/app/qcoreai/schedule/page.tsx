"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type ScheduleKind = "once" | "hourly" | "daily" | "weekly";
type Strategy = "sequential" | "parallel" | "debate";

type ScheduledBatch = {
  id: string;
  name: string;
  inputs: string[];
  strategy: Strategy;
  schedule: ScheduleKind;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastBatchId: string | null;
  enabled: boolean;
  createdAt: string;
};

const SCHEDULE_LABELS: Record<ScheduleKind, string> = {
  once: "One-time",
  hourly: "Every hour",
  daily: "Daily at 9am",
  weekly: "Weekly (Mon 9am)",
};

const SCHEDULE_COLORS: Record<ScheduleKind, string> = {
  once: "#4338ca",
  hourly: "#0369a1",
  daily: "#0d9488",
  weekly: "#7c3aed",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60_000) return past ? "just now" : "in <1 min";
  if (abs < 3_600_000) return `${past ? "" : "in "}${Math.round(abs / 60_000)}m${past ? " ago" : ""}`;
  if (abs < 86_400_000) return `${past ? "" : "in "}${Math.round(abs / 3_600_000)}h${past ? " ago" : ""}`;
  return `${past ? "" : "in "}${Math.round(abs / 86_400_000)}d${past ? " ago" : ""}`;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduledBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  // Create form
  const [name, setName] = useState("");
  const [inputsText, setInputsText] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("sequential");
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("daily");
  const [nextRunAt, setNextRunAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/qcoreai/schedules"), { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.items)) setSchedules(data.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const inputs = inputsText.split(/\n---\n|\n/).map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || inputs.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        inputs,
        strategy,
        schedule: scheduleKind,
      };
      if (scheduleKind === "once" && nextRunAt) body.nextRunAt = new Date(nextRunAt).toISOString();
      const res = await fetch(apiUrl("/api/qcoreai/schedules"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSchedules((p) => [data.schedule, ...p]);
      setName(""); setInputsText(""); setNextRunAt("");
    } catch (e: any) {
      setError(e?.message || "Failed to create schedule");
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/schedules/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSchedules((p) => p.map((s) => (s.id === id ? data.schedule : s)));
    } catch { /* noop */ }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    try {
      await fetch(apiUrl(`/api/qcoreai/schedules/${id}`), { method: "DELETE", headers: bearerHeader() });
      setSchedules((p) => p.filter((s) => s.id !== id));
    } catch { /* noop */ }
  };

  const runNow = async (id: string) => {
    setRunning((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/schedules/${id}/run-now`), {
        method: "POST", headers: bearerHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSchedules((p) => p.map((s) => s.id === id ? { ...s, lastBatchId: data.batchId, lastRunAt: new Date().toISOString() } : s));
      } else {
        setError(data.error || "Run-now failed");
      }
    } catch (e: any) {
      setError(e?.message || "Run-now failed");
    } finally {
      setRunning((p) => ({ ...p, [id]: false }));
    }
  };

  const parsedInputs = inputsText.split(/\n---\n|\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🕐 Scheduled Batches</h1>
            <Link href="/qcoreai/batch" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>
              ← Back to batch runs
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Automate recurring batch runs — daily reports, weekly digests, hourly monitors.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>

          {/* Create form */}
          <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>New schedule</div>

            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily market summary"
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            />

            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Prompts (one per line)</label>
            <textarea
              value={inputsText}
              onChange={(e) => setInputsText(e.target.value)}
              placeholder={"Summarise today's AI news\nWhat are the top risks in crypto today?"}
              rows={5}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, resize: "vertical", fontFamily: "inherit", outline: "none", marginBottom: 6, boxSizing: "border-box", background: "#f8fafc" }}
            />
            {parsedInputs.length > 0 && (
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{parsedInputs.length} prompt{parsedInputs.length !== 1 ? "s" : ""}</div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {(["sequential", "parallel", "debate"] as Strategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  style={{
                    padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: "1px solid " + (strategy === s ? "#0f172a" : "#cbd5e1"),
                    background: strategy === s ? "#0f172a" : "#fff",
                    color: strategy === s ? "#fff" : "#475569",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Recurrence</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {(["once", "hourly", "daily", "weekly"] as ScheduleKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setScheduleKind(k)}
                  style={{
                    padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: "1px solid " + (scheduleKind === k ? SCHEDULE_COLORS[k] : "#cbd5e1"),
                    background: scheduleKind === k ? `${SCHEDULE_COLORS[k]}15` : "#fff",
                    color: scheduleKind === k ? SCHEDULE_COLORS[k] : "#475569",
                  }}
                >
                  {SCHEDULE_LABELS[k]}
                </button>
              ))}
            </div>

            {scheduleKind === "once" && (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Run at</label>
                <input
                  type="datetime-local"
                  value={nextRunAt}
                  onChange={(e) => setNextRunAt(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                />
              </>
            )}

            <button
              onClick={submit}
              disabled={submitting || !name.trim() || parsedInputs.length === 0}
              style={{
                width: "100%", padding: "9px", borderRadius: 10, border: "none",
                background: !name.trim() || parsedInputs.length === 0 ? "#94a3b8" : "#4338ca",
                color: "#fff", fontWeight: 800, fontSize: 13,
                cursor: !name.trim() || parsedInputs.length === 0 ? "default" : "pointer",
              }}
            >
              {submitting ? "Creating…" : "Create schedule"}
            </button>
          </div>

          {/* Schedule list */}
          <div>
            {loading && <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</p>}
            {!loading && schedules.length === 0 && (
              <div
                style={{
                  padding: 40, borderRadius: 14, border: "1px dashed rgba(15,23,42,0.15)",
                  background: "rgba(15,23,42,0.02)", textAlign: "center",
                  color: "#94a3b8", fontSize: 13,
                }}
              >
                No schedules yet. Create one to automate recurring batch runs.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {schedules.map((s) => {
                const rel = fmtRelative(s.nextRunAt);
                const isRunning = running[s.id];
                return (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: 14, border: `1px solid ${s.enabled ? "rgba(67,56,202,0.2)" : "rgba(15,23,42,0.08)"}`,
                      background: s.enabled ? "#fff" : "#f8fafc", padding: "14px 16px",
                      opacity: s.enabled ? 1 : 0.65,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{s.name}</span>
                          <span
                            style={{
                              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                              background: `${SCHEDULE_COLORS[s.schedule]}15`,
                              color: SCHEDULE_COLORS[s.schedule],
                              border: `1px solid ${SCHEDULE_COLORS[s.schedule]}33`,
                            }}
                          >
                            {SCHEDULE_LABELS[s.schedule]}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "2px 8px", borderRadius: 999, background: "#f1f5f9" }}>
                            {s.strategy}
                          </span>
                          {!s.enabled && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8" }}>PAUSED</span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                          {s.inputs.length} prompt{s.inputs.length !== 1 ? "s" : ""}
                          {s.inputs.slice(0, 2).map((inp, i) => (
                            <span key={i} style={{ marginLeft: 8, color: "#64748b", fontStyle: "italic" }}>
                              "{inp.slice(0, 50)}{inp.length > 50 ? "…" : ""}"
                            </span>
                          ))}
                          {s.inputs.length > 2 && <span style={{ marginLeft: 4, color: "#94a3b8" }}>+{s.inputs.length - 2} more</span>}
                        </div>

                        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#94a3b8", flexWrap: "wrap" }}>
                          {s.nextRunAt && (
                            <span title={fmtDate(s.nextRunAt)}>
                              Next: <strong style={{ color: rel?.includes("ago") ? "#dc2626" : "#0f172a" }}>{rel || fmtDate(s.nextRunAt)}</strong>
                            </span>
                          )}
                          {s.lastRunAt && (
                            <span>
                              Last run: {fmtDate(s.lastRunAt)}
                              {s.lastBatchId && (
                                <Link href={`/qcoreai/batch/${s.lastBatchId}`} style={{ marginLeft: 6, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>
                                  View batch ↗
                                </Link>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => runNow(s.id)}
                          disabled={isRunning}
                          title="Fire this batch immediately"
                          style={{
                            padding: "5px 10px", borderRadius: 8, border: "1px solid #bfdbfe",
                            background: "#fff", color: "#1d4ed8", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          {isRunning ? "…" : "▶ Now"}
                        </button>
                        <button
                          onClick={() => toggle(s.id, !s.enabled)}
                          style={{
                            padding: "5px 10px", borderRadius: 8,
                            border: s.enabled ? "1px solid #fde68a" : "1px solid #bbf7d0",
                            background: "#fff",
                            color: s.enabled ? "#92400e" : "#065f46",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          {s.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          style={{
                            padding: "5px 10px", borderRadius: 8, border: "1px solid #fecaca",
                            background: "#fff", color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#991b1b", fontSize: 12, display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#991b1b", fontSize: 16, fontWeight: 700 }}>×</button>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
