"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    if (t) return { Authorization: `Bearer ${t}` };
  } catch {}
  return {};
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const EXPIRY_OPTIONS = [
  { label: "No expiry", value: 0 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "365 days", value: 365 },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/api-keys"), {
        headers: bearerHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setKeys(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setNewKey(null);
    try {
      const body: Record<string, unknown> = { name: newName.trim() };
      if (expiresInDays > 0) body.expiresInDays = expiresInDays;
      const res = await fetch(apiUrl("/api/qcoreai/me/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNewKey(data.key);
      setNewName("");
      setExpiresInDays(0);
      await fetchKeys();
    } catch (e: any) {
      alert(e?.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/me/api-keys/${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed — please select and copy manually.");
    }
  };

  return (
    <main style={{ background: "#f1f5f9", minHeight: "100vh", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
            borderRadius: 16,
            padding: "24px 24px 20px",
            color: "#fff",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900,
              }}
            >
              🔑
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>API Keys</h1>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Personal access tokens for programmatic access to QCoreAI</p>
            </div>
            <Link
              href="/qcoreai/multi"
              style={{
                marginLeft: "auto", padding: "6px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700,
              }}
            >
              ← Back
            </Link>
          </div>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
            Keys are prefixed with <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>qck_</code> and authenticated via the{" "}
            <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>X-QCore-Key</code> header.
            The raw key is shown only once — copy it now and store it safely.
          </p>
        </div>

        {/* One-time key reveal */}
        {newKey && (
          <div
            style={{
              background: "#fefce8", border: "2px solid #eab308",
              borderRadius: 12, padding: "16px 18px", marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, color: "#713f12", marginBottom: 8 }}>
              Your new API key — copy it now. It won&apos;t be shown again.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  background: "#1e1b4b", color: "#a5f3fc",
                  fontSize: 12, fontFamily: "monospace", wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {newKey}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: copied ? "#10b981" : "#0e7490",
                  border: "none", color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div
          style={{
            background: "#fff", borderRadius: 12, padding: "18px 20px",
            border: "1px solid #e2e8f0", marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 14 }}>Generate new key</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Key name (e.g. My Script)"
              style={{
                flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 13, outline: "none",
              }}
            />
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              style={{
                padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                fontSize: 13, background: "#fff", cursor: "pointer",
              }}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              style={{
                padding: "9px 20px", borderRadius: 8,
                background: newName.trim() && !creating ? "#0d9488" : "#cbd5e1",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: newName.trim() && !creating ? "pointer" : "default",
              }}
            >
              {creating ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Key list */}
        <div
          style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e2e8f0", overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 20px", borderBottom: "1px solid #f1f5f9",
              fontWeight: 800, fontSize: 13, color: "#0f172a",
            }}
          >
            Active keys {!loading && `(${keys.length})`}
          </div>

          {loading && (
            <div style={{ padding: "28px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              Loading…
            </div>
          )}

          {error && (
            <div style={{ padding: "16px 20px", color: "#dc2626", fontSize: 12 }}>
              {error} — are you logged in?
            </div>
          )}

          {!loading && !error && keys.length === 0 && (
            <div style={{ padding: "28px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No API keys yet. Generate one above.
            </div>
          )}

          {!loading && keys.map((k, i) => (
            <div
              key={k.id}
              style={{
                padding: "14px 20px",
                borderBottom: i < keys.length - 1 ? "1px solid #f1f5f9" : "none",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#a5f3fc", fontFamily: "monospace", fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {k.keyPrefix.slice(0, 4)}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{k.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>
                    {k.keyPrefix}…
                  </code>
                  {" · "}Created {fmtDate(k.createdAt)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Last used</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{fmtDate(k.lastUsedAt)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Expires</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: k.expiresAt ? "#d97706" : "#64748b" }}>
                    {k.expiresAt ? fmtDate(k.expiresAt) : "Never"}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(k.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 7, border: "1px solid #fecaca",
                    background: "rgba(220,38,38,0.05)", color: "#dc2626",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Usage hint */}
        <div
          style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 10,
            background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.2)",
            fontSize: 12, color: "#134e4a",
          }}
        >
          <strong>Usage:</strong> pass <code style={{ background: "rgba(13,148,136,0.1)", padding: "1px 5px", borderRadius: 4 }}>X-QCore-Key: qck_...</code> header in your requests.
          See <Link href="/qcoreai/docs" style={{ color: "#0d9488", fontWeight: 700 }}>API Docs</Link> for full reference.
        </div>
      </div>
    </main>
  );
}
