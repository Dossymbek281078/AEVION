"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

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
  status: string;
  score: number | null;
  totalCases: number;
  passedCases: number;
  totalCostUsd: number;
  results: EvalCaseResult[];
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

type Diff = "same_pass" | "same_fail" | "regressed" | "fixed" | "missing_a" | "missing_b";

function classify(a: EvalCaseResult | undefined, b: EvalCaseResult | undefined): Diff {
  if (!a) return "missing_a";
  if (!b) return "missing_b";
  if (a.passed && b.passed) return "same_pass";
  if (!a.passed && !b.passed) return "same_fail";
  if (a.passed && !b.passed) return "regressed";
  return "fixed";
}

function diffStyle(d: Diff): { bg: string; border: string; label: string; color: string } {
  switch (d) {
    case "same_pass": return { bg: "#f0fdf4", border: "#bbf7d0", label: "✔ both pass", color: "#15803d" };
    case "same_fail": return { bg: "#fef2f2", border: "#fecaca", label: "✘ both fail", color: "#991b1b" };
    case "regressed": return { bg: "#fff1f2", border: "#fda4af", label: "▼ REGRESSED", color: "#be123c" };
    case "fixed":     return { bg: "#ecfdf5", border: "#6ee7b7", label: "▲ FIXED", color: "#047857" };
    case "missing_a": return { bg: "#fafafa", border: "#e2e8f0", label: "+ new in B", color: "#64748b" };
    case "missing_b": return { bg: "#fafafa", border: "#e2e8f0", label: "− removed in B", color: "#64748b" };
  }
}

export default function CompareEvalRunsPage() {
  const params = useParams<{ suiteId: string }>();
  const search = useSearchParams();
  const suiteId = params?.suiteId as string;
  const aId = search?.get("a");
  const bId = search?.get("b");

  const [runA, setRunA] = useState<EvalRun | null>(null);
  const [runB, setRunB] = useState<EvalRun | null>(null);
  const [allRuns, setAllRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async (id: string): Promise<EvalRun | null> => {
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/runs/${id}`), { headers: bearerHeader() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data.run;
    } catch (e: any) {
      setError(e?.message || "fetch failed");
      return null;
    }
  }, []);

  const fetchAllRuns = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/eval/suites/${suiteId}/runs?limit=50`), {
        headers: bearerHeader(),
      });
      if (!r.ok) return;
      const data = await r.json();
      setAllRuns(data.items || []);
    } catch {
      /* ignore */
    }
  }, [suiteId]);

  useEffect(() => {
    if (!suiteId) return;
    setLoading(true);
    Promise.all([
      aId ? fetchRun(aId) : Promise.resolve(null),
      bId ? fetchRun(bId) : Promise.resolve(null),
      fetchAllRuns(),
    ]).then(([a, b]) => {
      setRunA(a);
      setRunB(b);
      setLoading(false);
    });
  }, [suiteId, aId, bId, fetchRun, fetchAllRuns]);

  const allCaseIds = useMemo(() => {
    const ids = new Set<string>();
    runA?.results.forEach((r) => ids.add(r.caseId));
    runB?.results.forEach((r) => ids.add(r.caseId));
    return Array.from(ids);
  }, [runA, runB]);

  const summary = useMemo(() => {
    const counts = { same_pass: 0, same_fail: 0, regressed: 0, fixed: 0, missing_a: 0, missing_b: 0 };
    for (const id of allCaseIds) {
      const a = runA?.results.find((r) => r.caseId === id);
      const b = runB?.results.find((r) => r.caseId === id);
      counts[classify(a, b)] += 1;
    }
    return counts;
  }, [allCaseIds, runA, runB]);

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

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <Link href={`/qcoreai/eval/${suiteId}`} style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>
            ← Back to suite
          </Link>
        </div>

        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Compare runs</h1>

        {/* Run selectors */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <RunSelector label="Run A" runs={allRuns} selected={runA} suiteId={suiteId} otherId={runB?.id} side="a" />
          <RunSelector label="Run B" runs={allRuns} selected={runB} suiteId={suiteId} otherId={runA?.id} side="b" />
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!runA || !runB ? (
          <div
            style={{
              marginTop: 24,
              padding: 28,
              border: "2px dashed #e2e8f0",
              borderRadius: 12,
              color: "#64748b",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Pick two runs above to compare them case-by-case.
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#fafbfc",
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 8,
                fontSize: 12,
              }}
            >
              <Stat label="Score Δ" value={
                runA.score != null && runB.score != null
                  ? `${runB.score >= runA.score ? "+" : ""}${((runB.score - runA.score) * 100).toFixed(1)}%`
                  : "—"
              } color={
                runA.score != null && runB.score != null
                  ? (runB.score >= runA.score ? "#15803d" : "#b91c1c")
                  : "#64748b"
              } />
              <Stat label="✔ both pass" value={String(summary.same_pass)} color="#15803d" />
              <Stat label="✘ both fail" value={String(summary.same_fail)} color="#991b1b" />
              <Stat label="▲ fixed" value={String(summary.fixed)} color="#047857" />
              <Stat label="▼ regressed" value={String(summary.regressed)} color="#be123c" />
              <Stat label="± changed" value={String(summary.missing_a + summary.missing_b)} color="#64748b" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 12, color: "#475569" }}>
              <div>
                <strong>Run A:</strong> {fmtDate(runA.startedAt)} · {fmtScore(runA.score)} · {fmtMoney(runA.totalCostUsd)}
              </div>
              <div>
                <strong>Run B:</strong> {fmtDate(runB.startedAt)} · {fmtScore(runB.score)} · {fmtMoney(runB.totalCostUsd)}
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {allCaseIds.map((caseId) => {
                const a = runA.results.find((r) => r.caseId === caseId);
                const b = runB.results.find((r) => r.caseId === caseId);
                const diff = classify(a, b);
                const ds = diffStyle(diff);
                const name = a?.caseName || b?.caseName || caseId;
                return (
                  <div
                    key={caseId}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${ds.border}`,
                      background: ds.bg,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <strong style={{ fontSize: 14 }}>{name}</strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: ds.color }}>{ds.label}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <CaseCell label="A" r={a} />
                      <CaseCell label="B" r={b} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </ProductPageShell>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 11 }}>{label}</div>
      <div style={{ color, fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function CaseCell({ label, r }: { label: string; r: EvalCaseResult | undefined }) {
  if (!r) {
    return (
      <div
        style={{
          padding: 10,
          background: "#fff",
          borderRadius: 6,
          border: "1px dashed #e2e8f0",
          color: "#94a3b8",
          fontSize: 12,
          fontStyle: "italic",
        }}
      >
        ({label}) — case not present in this run
      </div>
    );
  }
  return (
    <div
      style={{
        padding: 10,
        background: "#fff",
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 500, color: r.passed ? "#15803d" : "#991b1b" }}>
          ({label}) {r.passed ? "✔" : "✘"} {r.judgeKind}
        </span>
        <span style={{ color: "#64748b", fontSize: 11 }}>${r.costUsd.toFixed(4)} · {Math.round(r.durationMs / 100) / 10}s</span>
      </div>
      <div style={{ color: "#475569", marginTop: 4, fontStyle: "italic" }}>{r.reason}</div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", color: "#64748b", fontSize: 11 }}>output ({r.output.length} chars)</summary>
        <pre
          style={{
            marginTop: 6,
            padding: 8,
            background: "#f8fafc",
            borderRadius: 4,
            border: "1px solid #f1f5f9",
            fontSize: 11,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 280,
            overflow: "auto",
          }}
        >
          {r.output || "(empty)"}
        </pre>
      </details>
    </div>
  );
}

function RunSelector({
  label,
  runs,
  selected,
  suiteId,
  otherId,
  side,
}: {
  label: string;
  runs: EvalRun[];
  selected: EvalRun | null;
  suiteId: string;
  otherId?: string;
  side: "a" | "b";
}) {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <select
        value={selected?.id || ""}
        onChange={(e) => {
          const v = e.target.value;
          const params = new URLSearchParams(window.location.search);
          if (side === "a") params.set("a", v);
          else params.set("b", v);
          if (otherId) params.set(side === "a" ? "b" : "a", otherId);
          window.location.href = `/qcoreai/eval/${suiteId}/compare?${params.toString()}`;
        }}
        style={{
          width: "100%",
          padding: "6px 8px",
          border: "1px solid #cbd5e1",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <option value="">— pick a run —</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {fmtDate(r.startedAt)} — {fmtScore(r.score)} ({r.passedCases}/{r.totalCases})
          </option>
        ))}
      </select>
    </div>
  );
}
