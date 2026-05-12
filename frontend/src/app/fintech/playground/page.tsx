"use client";

import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

const PRESETS = [
  { label: "QPayNet stats",    method: "GET",  path: "/api/qpaynet/stats",         body: null,   auth: false },
  { label: "QPayNet health",   method: "GET",  path: "/api/qpaynet/health",        body: null,   auth: false },
  { label: "Z-Tide stats",     method: "GET",  path: "/api/ztide/stats",           body: null,   auth: false },
  { label: "QChainGov stats",  method: "GET",  path: "/api/qchaingov/stats",       body: null,   auth: false },
  { label: "QGood campaigns",  method: "GET",  path: "/api/qgood/campaigns?status=active", body: null, auth: false },
  { label: "VeilNetX head",    method: "GET",  path: "/api/veilnetx/chain/head",   body: null,   auth: false },
  { label: "API quotas",       method: "GET",  path: "/api/quotas",                body: null,   auth: false },
  { label: "QMedia tracks",    method: "GET",  path: "/api/qmedia/tracks",         body: null,   auth: false },
  { label: "My wallets",       method: "GET",  path: "/api/qpaynet/wallets",       body: null,   auth: true  },
  { label: "Create wallet",    method: "POST", path: "/api/qpaynet/wallets",       body: '{\n  "name": "Test wallet",\n  "currency": "KZT"\n}', auth: true },
];

export default function FintechPlaygroundPage() {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/qpaynet/stats");
  const [body, setBody] = useState("");
  const [token, setToken] = useState(() => typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") ?? "" : "");
  const [response, setResponse] = useState<{ status: number; data: unknown; ms: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setLoading(true); setError(""); setResponse(null);
    const t0 = Date.now();
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (method !== "GET" && body) headers["Content-Type"] = "application/json";
      const r = await fetch(apiUrl(path), {
        method,
        headers,
        body: method !== "GET" && body ? body : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json().catch(() => r.text());
      setResponse({ status: r.status, data, ms: Date.now() - t0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally { setLoading(false); }
  }

  function loadPreset(p: typeof PRESETS[0]) {
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body ?? "");
  }

  const statusColor = response ? (response.status < 300 ? "#10b981" : response.status < 500 ? "#f59e0b" : "#ef4444") : "#64748b";

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/fintech" className="text-slate-500 hover:text-slate-300 text-xs">← Fintech Hub</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">API Playground</span>
        </div>
        <Link href="/developers/fintech" className="text-xs text-indigo-400 hover:underline">Full docs →</Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-[200px_1fr] gap-6">
        {/* Presets sidebar */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Quick requests</p>
          <div className="space-y-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => loadPreset(p)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  path === p.path && method === p.method ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className={`font-mono mr-1.5 font-bold ${p.method === "GET" ? "text-teal-400" : "text-amber-400"}`}>{p.method}</span>
                {p.label}
                {p.auth && <span className="ml-1 text-[9px] text-slate-600">🔒</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Request builder */}
        <div className="space-y-4">
          {/* URL bar */}
          <div className="flex gap-2">
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500"
              style={{ color: method === "GET" ? "#34d399" : "#fbbf24", minWidth: 80 }}>
              {["GET","POST","PATCH","DELETE"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={path} onChange={e => setPath(e.target.value)}
              placeholder="/api/qpaynet/stats"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm font-mono text-teal-300 focus:outline-none focus:border-indigo-500" />
            <button onClick={send} disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl text-sm font-bold transition-colors">
              {loading ? "…" : "Send"}
            </button>
          </div>

          {/* Auth token */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Bearer token (optional)</label>
            <input value={token} onChange={e => setToken(e.target.value)}
              type="password" placeholder="aevion_auth_token_v1 from localStorage"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-slate-400 focus:outline-none focus:border-indigo-500" />
          </div>

          {/* Request body */}
          {method !== "GET" && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Request body (JSON)</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
          )}

          {/* Response */}
          {(response || error) && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold" style={{ color: statusColor }}>
                  HTTP {response?.status ?? "—"}
                </span>
                {response && <span className="text-xs text-slate-500">{response.ms}ms</span>}
              </div>
              <pre className="bg-[#0b0f1a] border border-slate-800 rounded-xl p-4 text-xs font-mono text-teal-300 overflow-x-auto max-h-80 overflow-y-auto">
                {error || JSON.stringify(response?.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
