"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type TopRun = {
  runId: string;
  thumbsUp: number;
  thumbsDown: number;
  score: number;
  userInput?: string;
  strategy?: string;
  totalCostUsd?: number;
};

export default function TopRatedPage() {
  const [items, setItems] = useState<TopRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, { userInput: string; strategy: string | null; totalCostUsd: number | null; finalContent: string | null }>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/ratings/top?limit=30"), { headers: bearerHeader() });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.items)) {
          setItems(data.items);
          // Load run details for the top items (first 10)
          const top10 = data.items.slice(0, 10);
          const details = await Promise.all(
            top10.map(async (item: TopRun) => {
              try {
                const r = await fetch(apiUrl(`/api/qcoreai/runs/${item.runId}`), { headers: bearerHeader() });
                const d = await r.json().catch(() => ({}));
                return [item.runId, d.run || d];
              } catch { return [item.runId, null]; }
            })
          );
          const detailMap: Record<string, any> = {};
          for (const [id, run] of details) {
            if (run) detailMap[id as string] = run;
          }
          setRunDetails(detailMap);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load top runs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>⭐ Top Rated Runs</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Highest-rated runs by 👍/👎 community feedback — sorted by score (thumbsUp − thumbsDown).
          </p>
        </div>

        {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {!loading && items.length === 0 && (
          <div style={{ padding: 32, borderRadius: 12, border: "1px dashed #cbd5e1", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            No rated runs yet. Rate a run with 👍/👎 in the multi-agent view to see it here.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, i) => {
            const detail = runDetails[item.runId];
            const score = item.thumbsUp - item.thumbsDown;
            const scoreColor = score > 0 ? "#065f46" : score < 0 ? "#991b1b" : "#64748b";
            return (
              <div key={item.runId} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 36, height: 36, borderRadius: 10, background: i < 3 ? ["#f59e0b", "#94a3b8", "#cd7c2e"][i] : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: i < 3 ? "#fff" : "#94a3b8", flexShrink: 0 }}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {detail ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {detail.userInput?.slice(0, 120) || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
                          {detail.strategy && (
                            <span style={{ padding: "1px 7px", borderRadius: 999, background: "#f1f5f9", fontWeight: 700 }}>{detail.strategy}</span>
                          )}
                          {detail.totalCostUsd != null && detail.totalCostUsd > 0 && (
                            <span>${detail.totalCostUsd.toFixed(4)}</span>
                          )}
                          {detail.finalContent && (
                            <span style={{ color: "#94a3b8" }}>{detail.finalContent.length} chars</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{item.runId.slice(0, 16)}…</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#065f46" }}>👍 {item.thumbsUp}</span>
                    <span style={{ fontSize: 11, color: "#991b1b" }}>👎 {item.thumbsDown}</span>
                    <span style={{ fontWeight: 900, fontSize: 14, color: scoreColor, minWidth: 30, textAlign: "center" }}>
                      {score > 0 ? `+${score}` : score}
                    </span>
                    <Link href={`/qcoreai/replay/${item.runId}`} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(124,58,237,0.3)", color: "#6d28d9", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
                      ▶ Replay
                    </Link>
                    <Link href={`/qcoreai/compare?a=${item.runId}`} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(67,56,202,0.3)", color: "#4338ca", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>
                      ⚖️
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ProductPageShell>
    </main>
  );
}
