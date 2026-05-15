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

type MemoryItem = {
  id: string;
  content: string;
  category: string;
  source: string | null;
  pinned: boolean;
  createdAt: string;
};

const CATEGORIES = ["general", "preference", "fact", "context"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
  preference: { bg: "rgba(124,58,237,0.07)", text: "#6d28d9", border: "rgba(124,58,237,0.2)" },
  fact: { bg: "rgba(16,185,129,0.07)", text: "#065f46", border: "rgba(16,185,129,0.2)" },
  context: { bg: "rgba(59,130,246,0.07)", text: "#1e40af", border: "rgba(59,130,246,0.2)" },
};

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPinned, setFilterPinned] = useState<boolean | null>(null);

  // Add form state
  const [addContent, setAddContent] = useState("");
  const [addCategory, setAddCategory] = useState<Category>("general");
  const [addPinned, setAddPinned] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterPinned !== null) params.set("pinned", String(filterPinned));
      const r = await fetch(apiUrl(`/api/qcoreai/me/memories?${params}`), { headers: bearerHeader() });
      const d = await r.json().catch(() => ({}));
      if (Array.isArray(d?.memories)) setMemories(d.memories);
      else setError("Failed to load memories");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMemories(); }, [filterCategory, filterPinned]);

  const togglePin = async (mem: MemoryItem) => {
    const newPinned = !mem.pinned;
    setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, pinned: newPinned } : m));
    try {
      await fetch(apiUrl(`/api/qcoreai/me/memories/${mem.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ pinned: newPinned }),
      });
    } catch {
      // revert
      setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, pinned: mem.pinned } : m));
    }
  };

  const deleteMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(apiUrl(`/api/qcoreai/me/memories/${id}`), { method: "DELETE", headers: bearerHeader() });
    } catch {
      await loadMemories();
    }
  };

  const addMemory = async () => {
    if (!addContent.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/me/memories"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ content: addContent.trim(), category: addCategory, pinned: addPinned }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.memory) {
        setMemories((prev) => [d.memory, ...prev]);
        setAddContent("");
        setAddCategory("general");
        setAddPinned(false);
      } else {
        setAddError(d?.error || "Failed to add memory");
      }
    } catch (e: any) {
      setAddError(e?.message || "Failed");
    } finally {
      setAddBusy(false);
    }
  };

  const pinnedCount = memories.filter((m) => m.pinned).length;

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🧠 AI Memory</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
            <span style={{ fontSize: 11, color: "#94a3b8", padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
              {memories.length} total · {pinnedCount} pinned
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Persistent facts, preferences, and context injected into your agent sessions.
            Pinned memories are automatically provided to the Analyst agent.
          </p>
        </div>

        {error && <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {/* Add memory form */}
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", background: "#f8fafc" }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#0f172a" }}>+ Add memory</div>
          <textarea
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            placeholder="Enter a fact, preference, or context you want the AI to remember…"
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value as Category)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, outline: "none", background: "#fff", color: "#0f172a" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={addPinned} onChange={(e) => setAddPinned(e.target.checked)} style={{ accentColor: "#7c3aed" }} />
              Pin (inject into every run)
            </label>
            <button
              onClick={addMemory}
              disabled={addBusy || !addContent.trim()}
              style={{
                padding: "7px 16px", borderRadius: 9, border: "none",
                background: addContent.trim() ? "#0f172a" : "#e2e8f0",
                color: addContent.trim() ? "#fff" : "#94a3b8",
                fontSize: 12, fontWeight: 700, cursor: addContent.trim() ? "pointer" : "default",
              }}
            >
              {addBusy ? "Saving…" : "Save memory"}
            </button>
            {addError && <span style={{ fontSize: 11, color: "#dc2626" }}>{addError}</span>}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Filter:</span>
          {["all", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${filterCategory === cat ? "#0f172a" : "#e2e8f0"}`,
                background: filterCategory === cat ? "#0f172a" : "#fff",
                color: filterCategory === cat ? "#fff" : "#475569",
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
          <div style={{ marginLeft: 8, display: "flex", gap: 6 }}>
            <button
              onClick={() => setFilterPinned(filterPinned === true ? null : true)}
              style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${filterPinned === true ? "#7c3aed" : "#e2e8f0"}`,
                background: filterPinned === true ? "rgba(124,58,237,0.1)" : "#fff",
                color: filterPinned === true ? "#6d28d9" : "#475569",
              }}
            >
              📌 Pinned only
            </button>
          </div>
        </div>

        {/* Memory list */}
        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>
        ) : memories.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", borderRadius: 12, border: "1px dashed #cbd5e1", color: "#94a3b8", fontSize: 13 }}>
            No memories yet. Add one above or extract from a run in Multi-agent.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {memories.map((mem) => {
              const colors = CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.general;
              return (
                <div
                  key={mem.id}
                  style={{
                    padding: "12px 14px", borderRadius: 12,
                    border: `1px solid ${mem.pinned ? "rgba(124,58,237,0.25)" : "rgba(15,23,42,0.08)"}`,
                    background: mem.pinned ? "rgba(124,58,237,0.03)" : "#fff",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}
                >
                  {/* Pin indicator */}
                  <span style={{ fontSize: 14, marginTop: 1, opacity: mem.pinned ? 1 : 0.25, flexShrink: 0 }}>📌</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, wordBreak: "break-word" }}>{mem.content}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                      }}>
                        {mem.category}
                      </span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>
                        {new Date(mem.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {mem.source && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>from run</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => togglePin(mem)}
                      title={mem.pinned ? "Unpin" : "Pin to all runs"}
                      style={{
                        padding: "4px 8px", borderRadius: 7, border: `1px solid ${mem.pinned ? "rgba(124,58,237,0.3)" : "#e2e8f0"}`,
                        background: mem.pinned ? "rgba(124,58,237,0.08)" : "#fff",
                        color: mem.pinned ? "#6d28d9" : "#94a3b8",
                        fontSize: 11, cursor: "pointer", fontWeight: 700,
                      }}
                    >
                      {mem.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      onClick={() => deleteMemory(mem.id)}
                      title="Delete memory"
                      style={{
                        padding: "4px 8px", borderRadius: 7, border: "1px solid #fecaca",
                        background: "#fff", color: "#dc2626",
                        fontSize: 11, cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
