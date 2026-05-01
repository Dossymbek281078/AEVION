"use client";

import { useCallback, useEffect, useState } from "react";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { apiUrl } from "@/lib/apiBase";

type Lead = {
  id: string;
  email: string;
  city: string | null;
  locale: string;
  source: string;
  referrer: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
};

export default function AdminLeadsPage() {
  return (
    <RequireAuth>
      <BuildShell>
        <Body />
      </BuildShell>
    </RequireAuth>
  );
}

function Body() {
  const token = useBuildAuth((s) => s.token);
  const user = useBuildAuth((s) => s.user);

  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await buildApi.adminLeads({ q: q || undefined, limit: 200 });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (!token) return;
    void refresh();
  }, [token, refresh]);

  if (user && user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        Only ADMIN accounts can view this page.
      </div>
    );
  }

  async function downloadCsv() {
    if (!token) return;
    const base = apiUrl("/api/build/admin/leads.csv");
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const url = `${base}${sp.toString() ? `?${sp.toString()}` : ""}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      setError(`CSV download failed (${r.status})`);
      return;
    }
    const blob = await r.blob();
    const a = document.createElement("a");
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = `qbuild-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-xs text-slate-400">
            Email captures from /build/why-aevion and other public landings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search email / city / utm…"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
          />
          <button
            onClick={refresh}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            onClick={downloadCsv}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
          >
            ⬇ CSV
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">Lang</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">UTM</th>
              <th className="px-3 py-2 text-left">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No leads yet.
                </td>
              </tr>
            ) : (
              items.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 font-mono text-xs text-emerald-200">{l.email}</td>
                  <td className="px-3 py-2 text-slate-200">{l.city || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{l.locale}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{l.source}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {[l.utmSource, l.utmCampaign].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{total.toLocaleString()} total leads.</p>
    </section>
  );
}
