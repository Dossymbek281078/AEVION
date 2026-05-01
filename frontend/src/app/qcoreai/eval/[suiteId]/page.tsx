"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type JudgeType = "contains" | "not_contains" | "equals" | "regex" | "min_length" | "max_length" | "llm_judge";

type EvalCase = {
  id: string;
  name?: string;
  input: string;
  judge:
    | { type: "contains"; needle: string; caseSensitive?: boolean }
    | { type: "not_contains"; needle: string; caseSensitive?: boolean }
    | { type: "equals"; expected: string; caseSensitive?: boolean; trim?: boolean }
    | { type: "regex"; pattern: string; flags?: string }
    | { type: "min_length"; chars: number }
    | { type: "max_length"; chars: number }
    | { type: "llm_judge"; rubric: string; provider?: string; model?: string; passThreshold?: number };
  weight?: number;
};

type Suite = {
  id: string;
  name: string;
  description: string | null;
  strategy: string;
  overrides: any;
  cases: EvalCase[];
  createdAt: string;
  updatedAt: string;
};

type EvalCaseResult = {
  caseId: string;
  caseName: string;
  passed: boolean;
  judgeKind: string;
  reason: string;
  output: string;
  costUsd: number;
  durationMs: number;
  error?: string;
};

type EvalRun = {
  id: string;
  suiteId: string;
  status: "running" | "done" | "error" | "aborted";
  score: number | null;
  totalCases: number;
  passedCases: number;
  totalCostUsd: number;
  results: EvalCaseResult[];
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function genId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function fmtScore(s: number | null) {
  if (s == null) return "—";
  return `${(s * 100).toFixed(1)}%`;
}

function fmtMoney(v: number) {
  if (!isFinite(v)) return "—";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function emptyJudge(type: JudgeType): EvalCase["judge"] {
  if (type === "contains") return { type, needle: "", caseSensitive: false };
  if (type === "not_contains") return { type, needle: "", caseSensitive: false };
  if (type === "equals") return { type, expected: "", caseSensitive: false, trim: true };
  if (type === "regex") return { type, pattern: "", flags: "i" };
  if (type === "min_length") return { type, chars: 50 };
  if (type === "max_length") return { type, chars: 4000 };
  return { type: "llm_judge", rubric: "", passThreshold: 0.7 };
}

function ScoreSparkline({ runs }: { runs: EvalRun[] }) {
  const pts = useMemo(() => {
    const rows = runs
      .filter((r) => r.status === "done" && typeof r.score === "number")
      .slice(0, 20)
      .reverse();
    if (rows.length < 2) return null;
    const W = 320;
    const H = 60;
    const xs = rows.map((_, i) => (i / (rows.length - 1)) * W);
    const ys = rows.map((r) => H - (r.score ?? 0) * H);
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
    const dots = xs.map((x, i) => ({ x, y: ys[i], passed: (rows[i].score ?? 0) >= 0.8 }));
    return { path, dots, W, H };
  }, [runs]);

  if (!pts) return null;

  return (
    <svg width={pts.W} height={pts.H} style={{ overflow: "visible" }}>
      <line x1={0} y1={pts.H * 0.2} x2={pts.W} y2={pts.H * 0.2} stroke="#e2e8f0" strokeDasharray="3,3" />
      <line x1={0} y1={pts.H * 0.5} x2={pts.W} y2={pts.H * 0.5} stroke="#e2e8f0" strokeDasharray="3,3" />
      <path d={pts.path} fill="none" stroke="#0d9488" strokeWidth={2} />
      {pts.dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={3}
          fill={d.passed ? "#0d9488" : "#dc2626"}
        />
      ))}
    </svg>
  );
}

export default function QCoreEvalSuitePage() {
  const params = useParams<{ suiteId: string }>();
  const router = useRouter();
  const suiteId = params?.suiteId as string;

  const [suite, setSuite] = useState<Suite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCases, setSavingCases] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [activeRun, setActiveRun] = useState<EvalRun | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const fetchSuite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}`), { headers: bearerHeader() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSuite(data.suite);
      setEditName(data.suite?.name || "");
      setEditDescription(data.suite?.description || "");
    } catch (e: any) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [suiteId]);

  const fetchRuns = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}/runs`), { headers: bearerHeader() });
      if (!r.ok) return;
      const data = await r.json();
      setRuns(data.items || []);
    } catch {
      /* ignore */
    }
  }, [suiteId]);

  useEffect(() => {
    if (!suiteId) return;
    fetchSuite();
    fetchRuns();
  }, [suiteId, fetchSuite, fetchRuns]);

  const persistCases = useCallback(
    async (cases: EvalCase[]) => {
      if (!suite) return;
      setSavingCases(true);
      try {
        const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...bearerHeader() },
          body: JSON.stringify({ cases }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setSuite(data.suite);
      } catch (e: any) {
        setError(e?.message || "save failed");
      } finally {
        setSavingCases(false);
      }
    },
    [suite, suiteId]
  );

  const persistMeta = useCallback(async () => {
    if (!suite) return;
    setRenaming(true);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSuite(data.suite);
    } catch (e: any) {
      setError(e?.message || "save failed");
    } finally {
      setRenaming(false);
    }
  }, [suite, suiteId, editName, editDescription]);

  const addCase = useCallback(() => {
    if (!suite) return;
    const next: EvalCase = {
      id: genId(),
      name: `Case ${(suite.cases?.length ?? 0) + 1}`,
      input: "",
      judge: emptyJudge("contains"),
      weight: 1,
    };
    persistCases([...(suite.cases || []), next]);
  }, [suite, persistCases]);

  const updateCase = useCallback(
    (idx: number, patch: Partial<EvalCase>) => {
      if (!suite) return;
      const next = [...(suite.cases || [])];
      next[idx] = { ...next[idx], ...patch };
      persistCases(next);
    },
    [suite, persistCases]
  );

  const deleteCase = useCallback(
    (idx: number) => {
      if (!suite) return;
      const next = (suite.cases || []).filter((_, i) => i !== idx);
      persistCases(next);
    },
    [suite, persistCases]
  );

  const setJudgeType = useCallback(
    (idx: number, type: JudgeType) => {
      updateCase(idx, { judge: emptyJudge(type) });
    },
    [updateCase]
  );

  const startRun = useCallback(async () => {
    if (!suite || !(suite.cases?.length ?? 0)) return;
    setStarting(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}/run`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ concurrency: 3 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setActiveRun(data.run);
    } catch (e: any) {
      setError(e?.message || "start failed");
    } finally {
      setStarting(false);
    }
  }, [suite, suiteId]);

  // Poll active run.
  useEffect(() => {
    if (!activeRun) return;
    if (activeRun.status !== "running") {
      fetchRuns();
      return;
    }
    const tick = async () => {
      try {
        const r = await fetch(apiUrl(`/api/qcoreai/eval/runs/${activeRun.id}`), { headers: bearerHeader() });
        if (!r.ok) return;
        const data = await r.json();
        if (data?.run) setActiveRun(data.run);
        if (data?.run?.status !== "running") {
          fetchRuns();
        } else {
          pollRef.current = window.setTimeout(tick, 1500);
        }
      } catch {
        pollRef.current = window.setTimeout(tick, 3000);
      }
    };
    pollRef.current = window.setTimeout(tick, 1500);
    return () => {
      if (pollRef.current) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeRun, fetchRuns]);

  const deleteSuite = useCallback(async () => {
    if (!suite) return;
    if (!confirm(`Delete suite "${suite.name}"? All run history will be lost.`)) return;
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      router.push("/qcoreai/eval");
    } catch (e: any) {
      setError(e?.message || "delete failed");
    }
  }, [suite, suiteId, router]);

  if (loading) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading…</div>
        </ProductPageShell>
      </main>
    );
  }

  if (!suite) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ color: "#991b1b", marginBottom: 12 }}>Suite not found.</div>
            <Link href="/qcoreai/eval">← Back to suites</Link>
          </div>
        </ProductPageShell>
      </main>
    );
  }

  const lastDoneRuns = runs.filter((r) => r.status === "done");
  const lastScore = lastDoneRuns[0]?.score ?? null;
  const prevScore = lastDoneRuns[1]?.score ?? null;
  const trend =
    lastScore != null && prevScore != null ? lastScore - prevScore : null;

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />
        <Link
          href="/qcoreai/eval"
          style={{
            display: "inline-block",
            marginBottom: 12,
            marginTop: 8,
            color: "#64748b",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← All suites
        </Link>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 20,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={persistMeta}
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  border: "1px solid transparent",
                  borderRadius: 6,
                  padding: "4px 6px",
                  background: "transparent",
                  color: "#0f172a",
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>{renaming ? "Saving…" : ""}</span>
            </div>
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onBlur={persistMeta}
              placeholder="Add a description"
              style={{
                width: "100%",
                fontSize: 13,
                color: "#475569",
                border: "1px solid transparent",
                borderRadius: 6,
                padding: "4px 6px",
                background: "transparent",
                marginTop: 4,
              }}
            />
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b", marginTop: 6 }}>
              <span>strategy: <strong style={{ color: "#0f172a" }}>{suite.strategy}</strong></span>
              <span>{(suite.cases || []).length} cases</span>
              <span>updated {fmtDate(suite.updatedAt)}</span>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fafbfc",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Last score</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>
              {fmtScore(lastScore)}
              {trend != null && (
                <span
                  style={{
                    fontSize: 13,
                    marginLeft: 8,
                    color: trend >= 0 ? "#15803d" : "#b91c1c",
                  }}
                >
                  {trend >= 0 ? "▲" : "▼"} {Math.abs(trend * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <ScoreSparkline runs={runs} />
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Cases</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={addCase}
              disabled={savingCases}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                fontSize: 13,
                cursor: savingCases ? "wait" : "pointer",
              }}
            >
              + Add case
            </button>
            <button
              onClick={startRun}
              disabled={starting || !(suite.cases?.length ?? 0) || activeRun?.status === "running"}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                background: starting || !(suite.cases?.length ?? 0) ? "#cbd5e1" : "#0d9488",
                color: "#fff",
                border: 0,
                fontSize: 13,
                fontWeight: 500,
                cursor: starting || !(suite.cases?.length ?? 0) ? "not-allowed" : "pointer",
              }}
            >
              {starting ? "Starting…" : activeRun?.status === "running" ? "Running…" : "▶ Run eval"}
            </button>
          </div>
        </div>

        {(suite.cases || []).length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              border: "2px dashed #e2e8f0",
              borderRadius: 10,
              color: "#64748b",
              fontSize: 13,
            }}
          >
            No cases yet. Add at least one to run evals.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(suite.cases || []).map((c, i) => (
              <CaseEditor
                key={c.id}
                value={c}
                onChange={(p) => updateCase(i, p)}
                onSetType={(t) => setJudgeType(i, t)}
                onDelete={() => deleteCase(i)}
              />
            ))}
          </div>
        )}

        {activeRun && (
          <div
            style={{
              marginTop: 24,
              padding: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: activeRun.status === "running" ? "#f0fdfa" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Run {activeRun.id.slice(0, 8)}</strong>
                <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>
                  {activeRun.status} · {activeRun.passedCases}/{activeRun.totalCases} passed · {fmtMoney(activeRun.totalCostUsd)}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {fmtScore(activeRun.score)}
              </div>
            </div>
            {activeRun.status === "running" && (
              <div
                style={{
                  marginTop: 10,
                  height: 4,
                  background: "#e2e8f0",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${activeRun.totalCases ? (activeRun.results.length / activeRun.totalCases) * 100 : 0}%`,
                    background: "#0d9488",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            )}
            {activeRun.errorMessage && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#991b1b" }}>{activeRun.errorMessage}</div>
            )}
            {activeRun.results.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {activeRun.results.slice(0, 50).map((r) => (
                  <div
                    key={r.caseId}
                    style={{
                      padding: 8,
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      background: r.passed ? "#f0fdf4" : "#fef2f2",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontWeight: 500, color: r.passed ? "#15803d" : "#991b1b" }}>
                        {r.passed ? "✔" : "✘"} {r.caseName}
                      </span>
                      <span style={{ color: "#64748b" }}>{fmtMoney(r.costUsd)} · {Math.round(r.durationMs / 100) / 10}s</span>
                    </div>
                    <div style={{ marginTop: 4, color: "#475569" }}>
                      <span style={{ color: "#64748b" }}>{r.judgeKind}:</span> {r.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <h3 style={{ marginTop: 28, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Run history</h3>
        {runs.length === 0 ? (
          <div style={{ padding: 16, color: "#64748b", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 8 }}>
            No runs yet.
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#475569", fontWeight: 500 }}>Started</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: "#475569", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 500 }}>Score</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 500 }}>Passed</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 500 }}>Cost</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: "#475569", fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => {
                  const prev = runs[i + 1];
                  return (
                    <tr
                      key={r.id}
                      style={{ borderTop: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "8px 12px", color: "#475569", cursor: "pointer" }} onClick={() => setActiveRun(r)}>{fmtDate(r.startedAt)}</td>
                      <td style={{ padding: "8px 12px", cursor: "pointer" }} onClick={() => setActiveRun(r)}>
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontSize: 11,
                            background:
                              r.status === "done" ? "#f0fdf4" :
                              r.status === "running" ? "#f0fdfa" :
                              r.status === "error" ? "#fef2f2" : "#f1f5f9",
                            color:
                              r.status === "done" ? "#15803d" :
                              r.status === "running" ? "#0d9488" :
                              r.status === "error" ? "#991b1b" : "#475569",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, cursor: "pointer" }} onClick={() => setActiveRun(r)}>{fmtScore(r.score)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#475569", cursor: "pointer" }} onClick={() => setActiveRun(r)}>
                        {r.passedCases}/{r.totalCases}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#475569", cursor: "pointer" }} onClick={() => setActiveRun(r)}>{fmtMoney(r.totalCostUsd)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {prev && r.status === "done" && prev.status === "done" && (
                          <Link
                            href={`/qcoreai/eval/${suiteId}/compare?a=${prev.id}&b=${r.id}`}
                            style={{ fontSize: 11, color: "#0d9488", textDecoration: "none", whiteSpace: "nowrap" }}
                          >
                            Compare ↔
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #f1f5f9", textAlign: "right" }}>
          <button
            onClick={deleteSuite}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Delete suite
          </button>
        </div>
      </ProductPageShell>
    </main>
  );
}

function CaseEditor({
  value,
  onChange,
  onSetType,
  onDelete,
}: {
  value: EvalCase;
  onChange: (patch: Partial<EvalCase>) => void;
  onSetType: (t: JudgeType) => void;
  onDelete: () => void;
}) {
  const j = value.judge;
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        background: "#fff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={value.name || ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Case name"
          style={{
            flex: 1,
            padding: "5px 8px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
          }}
        />
        <select
          value={j.type}
          onChange={(e) => onSetType(e.target.value as JudgeType)}
          style={{
            padding: "5px 8px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <option value="contains">contains</option>
          <option value="not_contains">not contains</option>
          <option value="equals">equals</option>
          <option value="regex">regex</option>
          <option value="min_length">min length</option>
          <option value="max_length">max length</option>
          <option value="llm_judge">LLM judge</option>
        </select>
        <button
          onClick={onDelete}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            background: "transparent",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <textarea
        value={value.input}
        onChange={(e) => onChange({ input: e.target.value })}
        placeholder="Input prompt — what to send to the multi-agent pipeline"
        rows={3}
        style={{
          padding: "8px 10px",
          border: "1px solid #cbd5e1",
          borderRadius: 6,
          fontSize: 13,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />

      {(j.type === "contains" || j.type === "not_contains") && (
        <input
          value={(j as any).needle}
          onChange={(e) => onChange({ judge: { ...j, needle: e.target.value } })}
          placeholder={j.type === "contains" ? "must contain…" : "must NOT contain…"}
          style={{
            padding: "5px 8px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 13,
          }}
        />
      )}

      {j.type === "equals" && (
        <textarea
          value={j.expected}
          onChange={(e) => onChange({ judge: { ...j, expected: e.target.value } })}
          placeholder="Expected output (whitespace-trimmed by default)"
          rows={2}
          style={{
            padding: "5px 8px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 13,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      )}

      {j.type === "regex" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 6 }}>
          <input
            value={j.pattern}
            onChange={(e) => onChange({ judge: { ...j, pattern: e.target.value } })}
            placeholder="^TL;DR.*"
            style={{
              padding: "5px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "monospace",
            }}
          />
          <input
            value={j.flags || ""}
            onChange={(e) => onChange({ judge: { ...j, flags: e.target.value } })}
            placeholder="flags"
            style={{
              padding: "5px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "monospace",
            }}
          />
        </div>
      )}

      {(j.type === "min_length" || j.type === "max_length") && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#475569" }}>{j.type === "min_length" ? "≥" : "≤"}</span>
          <input
            type="number"
            value={j.chars}
            onChange={(e) => onChange({ judge: { ...j, chars: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
            style={{
              width: 100,
              padding: "5px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <span style={{ color: "#64748b" }}>chars</span>
        </div>
      )}

      {j.type === "llm_judge" && (
        <>
          <textarea
            value={j.rubric}
            onChange={(e) => onChange({ judge: { ...j, rubric: e.target.value } })}
            placeholder="Rubric for the judge LLM. Example: &quot;Output must be in plain English, mention a TL;DR section, and avoid the phrase 'as a large language model'.&quot;"
            rows={3}
            style={{
              padding: "5px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 6, fontSize: 12 }}>
            <select
              value={j.provider || ""}
              onChange={(e) => onChange({ judge: { ...j, provider: e.target.value || undefined } })}
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <option value="">Default provider</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="grok">Grok</option>
            </select>
            <input
              value={j.model || ""}
              onChange={(e) => onChange({ judge: { ...j, model: e.target.value || undefined } })}
              placeholder="Model (e.g. claude-haiku-4-5-20251001)"
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            />
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={j.passThreshold ?? 0.7}
              onChange={(e) =>
                onChange({
                  judge: {
                    ...j,
                    passThreshold: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)),
                  },
                })
              }
              title="Confidence threshold (0..1) — passes only if VERDICT=PASS and confidence ≥ threshold"
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
