"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type SearchResult = {
  type: "session" | "run";
  id: string;
  sessionId?: string;
  snippet: string;
  title?: string | null;
  createdAt: string;
};

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export default function QCoreSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/search?q=${encodeURIComponent(q)}&limit=30`), { headers: bearerHeader() });
      const d = await res.json().catch(() => ({}));
      setResults(Array.isArray(d.results) ? d.results : []);
      setSearched(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const sessions = results.filter((r) => r.type === "session");
  const runs = results.filter((r) => r.type === "run");

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🔎 Search</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Back</Link>
          </div>

          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#94a3b8", pointerEvents: "none" }}>🔎</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(query); }}
              placeholder="Search sessions and runs…"
              style={{
                width: "100%", padding: "14px 16px 14px 44px",
                borderRadius: 14, border: "1.5px solid rgba(15,23,42,0.15)",
                fontSize: 16, fontFamily: "inherit", outline: "none",
                background: "#fff", boxSizing: "border-box",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            />
            {loading && (
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 12 }}>
                Searching…
              </span>
            )}
          </div>

          {/* Results */}
          {!searched && !loading && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
              <p style={{ fontSize: 14, margin: 0 }}>Search across all your sessions and run prompts.</p>
              <p style={{ fontSize: 12, margin: "6px 0 0", color: "#cbd5e1" }}>Type at least 3 characters to start searching.</p>
            </div>
          )}

          {searched && results.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
              <p style={{ fontSize: 14, margin: 0 }}>No results for <strong>&ldquo;{query}&rdquo;</strong></p>
            </div>
          )}

          {sessions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Sessions ({sessions.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sessions.map((r) => (
                  <Link
                    key={r.id}
                    href={`/qcoreai/multi`}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        sessionStorage.setItem("qcore_load_session", r.id);
                      }
                    }}
                    style={{
                      padding: "12px 16px", borderRadius: 12,
                      border: "1px solid rgba(15,23,42,0.1)",
                      background: "#fff", textDecoration: "none",
                      display: "flex", gap: 12, alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>💬</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.title || r.snippet || "(untitled)"}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#4338ca", fontWeight: 700, flexShrink: 0 }}>Open →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {runs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Runs ({runs.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {runs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/qcoreai/multi`}
                    onClick={() => {
                      if (typeof window !== "undefined" && r.sessionId) {
                        sessionStorage.setItem("qcore_load_session", r.sessionId);
                      }
                    }}
                    style={{
                      padding: "12px 16px", borderRadius: 12,
                      border: "1px solid rgba(15,23,42,0.08)",
                      background: "#f8fafc", textDecoration: "none",
                      display: "flex", gap: 12, alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {r.snippet}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                        {new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}
