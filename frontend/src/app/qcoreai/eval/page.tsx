"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Suite = {
  id: string;
  name: string;
  description: string | null;
  strategy: string;
  cases: any[];
  updatedAt: string;
};

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function QCoreEvalListPage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strategy, setStrategy] = useState("sequential");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchSuites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = bearerHeader();
      if (!("Authorization" in headers)) {
        setAuthMissing(true);
        setLoading(false);
        return;
      }
      const r = await fetch(apiUrl("/api/qcoreai/eval/suites"), { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSuites(data.items || []);
    } catch (e: any) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  const createSuite = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/eval/suites"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          strategy,
          cases: [],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setName("");
      setDescription("");
      setStrategy("sequential");
      setCreateOpen(false);
      await fetchSuites();
    } catch (e: any) {
      setError(e?.message || "create failed");
    } finally {
      setCreating(false);
    }
  }, [name, description, strategy, fetchSuites]);

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 16,
            background: "linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0d9488 100%)",
            color: "#fff",
            padding: "28px 28px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              🧪
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                QCoreAI · Evals
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.78 }}>
                Track quality regressions across prompt + agent config changes.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Eval suites</h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
              Run a fixed set of test cases through your multi-agent pipeline.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/qcoreai/multi"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#f1f5f9",
                color: "#0f172a",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid #e2e8f0",
              }}
            >
              ← Multi-agent
            </Link>
            <button
              onClick={() => setCreateOpen((v) => !v)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: createOpen ? "#1e293b" : "#0f172a",
                color: "#fff",
                border: 0,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {createOpen ? "Close" : "+ New suite"}
            </button>
          </div>
        </div>

        {createOpen && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              background: "#fafbfc",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Onboarding writer regression"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Description (optional)</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this suite verify?"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Strategy</span>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="debate">Debate</option>
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={createSuite}
                  disabled={creating || !name.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: creating || !name.trim() ? "#cbd5e1" : "#0f172a",
                    color: "#fff",
                    border: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: creating || !name.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {creating ? "Creating…" : "Create suite"}
                </button>
              </div>
            </div>
          </div>
        )}

        {authMissing && (
          <div
            style={{
              padding: 16,
              border: "1px solid #fde68a",
              background: "#fef3c7",
              color: "#78350f",
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            Sign in to create eval suites. <Link href="/auth" style={{ color: "#9a3412", textDecoration: "underline" }}>Go to /auth</Link>.
          </div>
        )}

        {error && !authMissing && (
          <div
            style={{
              padding: 12,
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

        {loading && !authMissing ? (
          <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>Loading…</div>
        ) : suites.length === 0 && !authMissing ? (
          <div
            style={{
              padding: 36,
              textAlign: "center",
              border: "2px dashed #e2e8f0",
              borderRadius: 12,
              color: "#64748b",
              fontSize: 14,
            }}
          >
            No suites yet. Create one above to start tracking eval scores.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {suites.map((s) => (
              <Link
                key={s.id}
                href={`/qcoreai/eval/${s.id}`}
                style={{
                  display: "block",
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "inherit",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{s.name}</div>
                    {s.description && (
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.description}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "#f1f5f9",
                        color: "#0f172a",
                        fontWeight: 500,
                      }}
                    >
                      {s.strategy}
                    </span>
                    <span>{(s.cases || []).length} cases</span>
                    <span>updated {fmtDate(s.updatedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
