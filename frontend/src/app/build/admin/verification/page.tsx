"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { useBuildAuth } from "@/lib/build/auth";

type VerifRow = {
  id: string;
  userId: string;
  status: string;
  note: string | null;
  createdAt: string;
  name: string;
  email: string;
  city: string | null;
  buildRole: string | null;
  experienceYears: number | null;
};

export default function AdminVerificationPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const token = useBuildAuth((s) => s.token);
  const [items, setItems] = useState<VerifRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/build/verification/admin/queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.success) setItems(j.data.items);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function approve(userId: string) {
    await fetch(`/api/build/verification/admin/${userId}/approve`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  async function reject(userId: string) {
    const reason = prompt("Reason for rejection (optional):");
    await fetch(`/api/build/verification/admin/${userId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    load();
  }

  if (user && user.role !== "ADMIN") {
    return <div className="text-sm text-rose-200">Admin only.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/build/admin" className="text-xs text-slate-400 hover:underline">← Admin</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Verification queue</h1>
        <p className="text-xs text-slate-400">{items.length} pending request{items.length !== 1 ? "s" : ""}</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">No pending verification requests.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/build/u/${encodeURIComponent(row.userId)}`} className="font-semibold text-white hover:text-emerald-200">
                    {row.name}
                  </Link>
                  <span className="text-xs text-slate-400">{row.email}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-400">
                  {row.buildRole && <span>{row.buildRole}</span>}
                  {row.city && <span>📍 {row.city}</span>}
                  {row.experienceYears != null && row.experienceYears > 0 && <span>⏱ {row.experienceYears}y</span>}
                  <span>Submitted {new Date(row.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
                {row.note && (
                  <p className="mt-2 text-sm text-slate-300 italic">&ldquo;{row.note}&rdquo;</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => approve(row.userId)}
                  className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => reject(row.userId)}
                  className="rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
