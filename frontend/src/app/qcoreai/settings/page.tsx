"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token") || localStorage.getItem("aevion_auth_token_v1");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type ContentFilters = {
  blockedWords?: string[];
  maxOutputLength?: number;
  requireSafeSearch?: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Content filter state
  const [blockedWords, setBlockedWords] = useState("");
  const [maxOutputLength, setMaxOutputLength] = useState("");
  const [requireSafeSearch, setRequireSafeSearch] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/me/settings"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => {
        const cf: ContentFilters = d?.settings?.["content-filters"] || {};
        if (Array.isArray(cf.blockedWords)) setBlockedWords(cf.blockedWords.join(", "));
        if (cf.maxOutputLength) setMaxOutputLength(String(cf.maxOutputLength));
        if (cf.requireSafeSearch) setRequireSafeSearch(true);
      })
      .catch((e) => setError(e?.message || "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const value: ContentFilters = {};
      const words = blockedWords.split(",").map((w) => w.trim()).filter(Boolean);
      if (words.length > 0) value.blockedWords = words;
      if (maxOutputLength && parseInt(maxOutputLength) > 0) value.maxOutputLength = parseInt(maxOutputLength);
      if (requireSafeSearch) value.requireSafeSearch = true;

      const r = await fetch(apiUrl("/api/qcoreai/me/settings/content-filters"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ value }),
      });
      const d = await r.json();
      if (d.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(d.error || "Save failed");
      }
    } catch (e: any) { setError(e?.message); }
    setSaving(false);
  };

  const clearFilters = async () => {
    await fetch(apiUrl("/api/qcoreai/me/settings/content-filters"), {
      method: "DELETE",
      headers: bearerHeader(),
    });
    setBlockedWords("");
    setMaxOutputLength("");
    setRequireSafeSearch(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", margin: 0 }}>Settings</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0" }}>Manage your QCoreAI preferences and content filters</p>
        </div>

        <Link href="/qcoreai" style={{ fontSize: 13, color: "#6366f1", textDecoration: "none" }}>← Back to QCoreAI</Link>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#dc2626", marginTop: 16, fontSize: 14 }}>
            {error} <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", marginLeft: 8, fontWeight: 700 }}>×</button>
          </div>
        )}

        {loading ? (
          <div style={{ color: "#94a3b8", marginTop: 32 }}>Loading settings…</div>
        ) : (
          <div style={{ marginTop: 24 }}>
            {/* Content Filters section */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Content Filters</h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 20px" }}>
                Filter output content from the multi-agent pipeline. Blocked words are replaced with [filtered].
              </p>

              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Blocked words (comma-separated)</span>
                <input
                  value={blockedWords}
                  onChange={(e) => setBlockedWords(e.target.value)}
                  placeholder="e.g., spam, offensive, restricted"
                  style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                />
                <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "block" }}>
                  These words will be replaced with [filtered] in agent responses
                </span>
              </label>

              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Max output length (characters)</span>
                <input
                  type="number"
                  value={maxOutputLength}
                  onChange={(e) => setMaxOutputLength(e.target.value)}
                  placeholder="e.g., 4000 (leave blank for unlimited)"
                  min={100}
                  max={100000}
                  style={{ display: "block", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, width: 220 }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={requireSafeSearch}
                  onChange={(e) => setRequireSafeSearch(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: "#374151" }}>Enable safe search mode</span>
              </label>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : saved ? "Saved!" : "Save settings"}
                </button>
                <button
                  onClick={clearFilters}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 20px", color: "#64748b", cursor: "pointer", fontSize: 14 }}
                >
                  Clear all filters
                </button>
              </div>

              {saved && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#10b981", fontWeight: 600 }}>
                  Settings saved successfully.
                </div>
              )}
            </div>

            {/* Links to related settings */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>More settings</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { href: "/qcoreai/budget", label: "Budget & spend limits", icon: "💰" },
                  { href: "/qcoreai/api-keys", label: "API keys", icon: "🔑" },
                  { href: "/qcoreai/providers", label: "AI providers", icon: "◈" },
                  { href: "/qcoreai/memory", label: "AI memory", icon: "🧠" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#374151", fontSize: 14, transition: "background 0.15s" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProductPageShell>
  );
}
