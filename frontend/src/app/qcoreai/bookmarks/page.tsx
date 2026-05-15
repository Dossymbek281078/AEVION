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

type Bookmark = { runId: string; label: string | null; createdAt: string };
type RunDetail = { userInput: string; strategy: string | null; totalCostUsd: number | null; status: string; finalContent: string | null };

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [runDetails, setRunDetails] = useState<Record<string, RunDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/bookmarks?limit=50"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then(async (d) => {
        if (Array.isArray(d?.items)) {
          setBookmarks(d.items);
          const details = await Promise.all(
            d.items.slice(0, 20).map(async (bk: Bookmark) => {
              const r = await fetch(apiUrl(`/api/qcoreai/runs/${bk.runId}`), { headers: bearerHeader() });
              const rd = await r.json().catch(() => ({}));
              return [bk.runId, rd.run || rd];
            })
          );
          const map: Record<string, RunDetail> = {};
          for (const [id, run] of details) if (run) map[id as string] = run;
          setRunDetails(map);
        }
      })
      .catch((e) => setError(e?.message || "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const removeBookmark = async (runId: string) => {
    await fetch(apiUrl(`/api/qcoreai/runs/${runId}/bookmark`), { method: "DELETE", headers: bearerHeader() });
    setBookmarks((p) => p.filter((b) => b.runId !== runId));
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🔖 Bookmarks</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Starred runs for quick re-access.</p>
        </div>

        {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {!loading && bookmarks.length === 0 && (
          <div style={{ padding: 32, borderRadius: 12, border: "1px dashed #e2e8f0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔖</div>
            No bookmarks yet. Click 🏷️ on any run to bookmark it.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookmarks.map((bk) => {
            const detail = runDetails[bk.runId];
            return (
              <div key={bk.runId} style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.03)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16 }}>🔖</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {bk.label && <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>{bk.label}</div>}
                    {detail ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {detail.userInput?.slice(0, 120) || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                          {detail.strategy && <span style={{ padding: "1px 7px", borderRadius: 999, background: "#f1f5f9", fontWeight: 700 }}>{detail.strategy}</span>}
                          {detail.totalCostUsd != null && detail.totalCostUsd > 0 && <span>${detail.totalCostUsd.toFixed(4)}</span>}
                          <span style={{ color: "#94a3b8" }}>{new Date(bk.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{bk.runId.slice(0, 16)}…</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Link href={`/qcoreai/replay/${bk.runId}`} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(124,58,237,0.3)", color: "#6d28d9", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>▶ Replay</Link>
                    <Link href={`/qcoreai/compare?a=${bk.runId}`} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(67,56,202,0.3)", color: "#4338ca", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>⚖️</Link>
                    <button onClick={() => removeBookmark(bk.runId)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#991b1b", fontSize: 10, cursor: "pointer" }}>×</button>
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
