"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type Policy = {
  id: string;
  type: "license" | "restriction" | "attribution";
  scope: string;
  termsText: string;
  spdxId?: string | null;
  url?: string | null;
  validUntil?: string | null;
  createdAt: string;
};

const POLICY_TYPES = ["license", "restriction", "attribution"] as const;
const POLICY_SCOPES = [
  "commercial", "non-commercial", "educational",
  "internal", "personal", "all",
] as const;

const SPDX_PRESETS = [
  { id: "CC-BY-4.0", label: "CC BY 4.0" },
  { id: "CC-BY-NC-4.0", label: "CC BY-NC 4.0" },
  { id: "CC-BY-SA-4.0", label: "CC BY-SA 4.0" },
  { id: "CC0-1.0", label: "CC0 1.0 (Public Domain)" },
  { id: "MIT", label: "MIT" },
  { id: "Apache-2.0", label: "Apache 2.0" },
  { id: "All-Rights-Reserved", label: "All Rights Reserved" },
];

const TYPE_COLOR: Record<string, string> = {
  license: "#0d9488",
  restriction: "#dc2626",
  attribution: "#7c3aed",
};

function authHeaders(): HeadersInit {
  const tok = typeof window !== "undefined" ? localStorage.getItem("aevion_token") : null;
  return tok ? { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function PoliciesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const objectId = params?.id ?? "";

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // form state
  const [type, setType] = useState<typeof POLICY_TYPES[number]>("license");
  const [scope, setScope] = useState<typeof POLICY_SCOPES[number]>("all");
  const [termsText, setTermsText] = useState("");
  const [spdxId, setSpdxId] = useState("");
  const [url, setUrl] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  async function load() {
    try {
      const r = await fetch(apiUrl(`/api/qright/objects/${encodeURIComponent(objectId)}/policies`));
      if (!r.ok) { setErr("Failed to load policies"); return; }
      const j = await r.json();
      setPolicies(j.policies ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (objectId) load(); }, [objectId]);

  async function addPolicy() {
    if (!termsText.trim() || termsText.trim().length < 3) { setAddErr("Terms text must be at least 3 characters"); return; }
    setAdding(true); setAddErr("");
    try {
      const r = await fetch(apiUrl(`/api/qright/objects/${encodeURIComponent(objectId)}/policies`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ type, scope, termsText: termsText.trim(), spdxId: spdxId || null, url: url || null, validUntil: validUntil || null }),
      });
      if (r.status === 401) { setAddErr("Not authenticated — please log in"); return; }
      if (r.status === 403) { setAddErr("Only the object owner can add policies"); return; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); setAddErr(j.error ?? "Failed to add policy"); return; }
      setTermsText(""); setSpdxId(""); setUrl(""); setValidUntil("");
      await load();
    } catch {
      setAddErr("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function revokePolicy(policyId: string) {
    if (!window.confirm("Revoke this policy? It will stop appearing publicly.")) return;
    try {
      const r = await fetch(apiUrl(`/api/qright/policies/${encodeURIComponent(policyId)}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) { alert("Failed to revoke policy"); return; }
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    } catch {
      alert("Network error");
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,0.1)",
    borderRadius: 16,
    padding: 22,
    background: "#fff",
    marginBottom: 18,
  };

  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 4,
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.15)", fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <Link
            href={`/qright/object/${objectId}`}
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8 }}
          >
            ← Back to object
          </Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
            Usage Policies
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            Define how others may use this protected work. Policies are publicly visible.
          </p>
        </div>

        {/* Add policy form */}
        <div style={card}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
            Add policy
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <span style={label}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={input}>
                {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Scope</span>
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} style={input}>
                {POLICY_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={label}>SPDX license identifier (optional)</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {SPDX_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSpdxId(p.id); if (!termsText) setTermsText(p.label); }}
                  style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                    border: spdxId === p.id ? "1.5px solid #0d9488" : "1px solid rgba(15,23,42,0.15)",
                    background: spdxId === p.id ? "#ccfbf1" : "#fff",
                    fontWeight: spdxId === p.id ? 800 : 400,
                    color: "#0f172a",
                  }}
                >
                  {p.id}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={spdxId}
              onChange={(e) => setSpdxId(e.target.value)}
              placeholder="e.g. CC-BY-4.0"
              style={input}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={label}>Terms text *</span>
            <textarea
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Describe usage terms, restrictions, or attribution requirements..."
              rows={3}
              style={{ ...input, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {termsText.length}/5000
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <span style={label}>URL (optional)</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={input}
              />
            </div>
            <div>
              <span style={label}>Valid until (optional)</span>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={input}
              />
            </div>
          </div>

          {addErr && (
            <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 10 }}>{addErr}</div>
          )}

          <button
            onClick={addPolicy}
            disabled={adding || !termsText.trim()}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: adding || !termsText.trim() ? "#cbd5e1" : "#7c3aed",
              color: "#fff", fontWeight: 800, fontSize: 13,
              cursor: adding || !termsText.trim() ? "not-allowed" : "pointer",
            }}
          >
            {adding ? "Adding…" : "Add policy"}
          </button>
        </div>

        {/* Existing policies */}
        <div style={card}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
            Active policies ({policies.length})
          </h2>

          {loading ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading…</div>
          ) : err ? (
            <div style={{ fontSize: 13, color: "#dc2626" }}>{err}</div>
          ) : policies.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>No policies yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {policies.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 10, padding: "12px 14px", background: "#f8fafc",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        background: TYPE_COLOR[p.type] ?? "#475569",
                        color: "#fff", fontSize: 10, fontWeight: 800,
                        padding: "2px 7px", borderRadius: 4, textTransform: "uppercase",
                      }}>
                        {p.type}
                      </span>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        {p.scope}
                      </span>
                      {p.spdxId && (
                        <span style={{ fontSize: 11, color: "#0d9488", fontFamily: "ui-monospace,monospace" }}>
                          {p.spdxId}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.5 }}>
                      {p.termsText}
                    </p>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "#0d9488", display: "block", marginTop: 4 }}>
                        {p.url}
                      </a>
                    )}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                      Added {new Date(p.createdAt).toLocaleDateString()}
                      {p.validUntil && ` · until ${new Date(p.validUntil).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => revokePolicy(p.id)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 6,
                      border: "1px solid rgba(220,38,38,0.3)", background: "transparent",
                      color: "#dc2626", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
