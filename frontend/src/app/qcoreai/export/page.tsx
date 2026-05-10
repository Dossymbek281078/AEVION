"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type SessionRow = { id: string; title: string; updatedAt: string };

export default function ExportHubPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [includeMessages, setIncludeMessages] = useState(false);
  const [sessionExporting, setSessionExporting] = useState(false);
  const [accountExporting, setAccountExporting] = useState(false);
  const [lastAccountExport, setLastAccountExport] = useState<string | null>(null);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("qcore_last_account_export") : null;
    if (stored) setLastAccountExport(stored);

    fetch(apiUrl("/api/qcoreai/sessions?limit=100"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => {
        const list: SessionRow[] = Array.isArray(d?.sessions)
          ? d.sessions
          : Array.isArray(d)
          ? d
          : [];
        setSessions(list);
        if (list.length > 0) setSelectedSessionId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSession = async () => {
    if (!selectedSessionId) return;
    setSessionExporting(true);
    setSessionMsg(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/export/session-bundle"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ sessionId: selectedSessionId, includeMessages }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSessionMsg(`Error: ${err.error || res.status}`);
        return;
      }
      const data = await res.json();
      const title = data.session?.title || selectedSessionId;
      downloadJson(data, `session-${selectedSessionId}.json`);
      setSessionMsg(`Exported "${title}" successfully.`);
    } catch (e: any) {
      setSessionMsg(`Error: ${e?.message || "unknown"}`);
    } finally {
      setSessionExporting(false);
    }
  };

  const exportFullAccount = async () => {
    setAccountExporting(true);
    setAccountMsg(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/export/full-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({}),
      });
      if (res.status === 429) {
        const err = await res.json().catch(() => ({}));
        const waitMin = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 60000) : 60;
        setAccountMsg(`Rate limited. Please wait ~${waitMin} minutes before exporting again.`);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAccountMsg(`Error: ${err.error || res.status}`);
        return;
      }
      const data = await res.json();
      const now = new Date().toISOString();
      downloadJson(data, `qcoreai-account-${now.slice(0, 10)}.json`);
      if (typeof window !== "undefined") localStorage.setItem("qcore_last_account_export", now);
      setLastAccountExport(now);
      setAccountMsg("Full account data exported successfully.");
    } catch (e: any) {
      setAccountMsg(`Error: ${e?.message || "unknown"}`);
    } finally {
      setAccountExporting(false);
    }
  };

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: "24px 28px",
    marginBottom: 20,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/qcoreai/multi" style={{ fontSize: 13, color: "#6d28d9", textDecoration: "none" }}>
            ← Back to QCoreAI
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "12px 0 4px" }}>
            📦 Export Hub
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Download your QCoreAI data as JSON files for backup or analysis.
          </p>
        </div>

        {/* Session Export */}
        <div style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
            Export Session
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
            Downloads session info, all runs, annotations, and bookmarks as JSON.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a",
                background: "#fff", outline: "none",
              }}
            >
              {sessions.length === 0 && <option value="">No sessions found</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "(untitled)"} — {new Date(s.updatedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeMessages}
              onChange={(e) => setIncludeMessages(e.target.checked)}
            />
            Include all agent messages (larger file)
          </label>

          <button
            onClick={exportSession}
            disabled={sessionExporting || !selectedSessionId}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: "#6d28d9", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: sessionExporting ? "wait" : "pointer",
              opacity: sessionExporting ? 0.7 : 1,
            }}
          >
            {sessionExporting ? "Exporting…" : "Export JSON"}
          </button>

          {sessionMsg && (
            <p style={{ marginTop: 10, fontSize: 12, color: sessionMsg.startsWith("Error") ? "#dc2626" : "#065f46" }}>
              {sessionMsg}
            </p>
          )}
        </div>

        {/* Full Account Export */}
        <div style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
            Export Full Account
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>
            Downloads all your sessions, prompts, templates, memories, and API key metadata.
            Agent messages are excluded to keep the file manageable.
          </p>
          <p style={{ fontSize: 12, color: "#f59e0b", margin: "0 0 16px", fontWeight: 600 }}>
            Rate limit: 1 export per hour.
          </p>

          {lastAccountExport && (
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              Last exported: {new Date(lastAccountExport).toLocaleString()}
            </p>
          )}

          <button
            onClick={exportFullAccount}
            disabled={accountExporting}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: "#0f172a", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: accountExporting ? "wait" : "pointer",
              opacity: accountExporting ? 0.7 : 1,
            }}
          >
            {accountExporting ? "Preparing…" : "Download everything"}
          </button>

          {accountMsg && (
            <p style={{ marginTop: 10, fontSize: 12, color: accountMsg.startsWith("Error") || accountMsg.startsWith("Rate") ? "#dc2626" : "#065f46" }}>
              {accountMsg}
            </p>
          )}
        </div>

        <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
          Exports are generated on-demand and not stored on our servers.
        </p>
      </div>
    </div>
  );
}
