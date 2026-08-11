"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { useBuildAuth } from "@/lib/build/auth";
import { buildApi, type BuildVerificationRequest } from "@/lib/build/api";

type VerifRow = BuildVerificationRequest;

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

  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await buildApi.adminVerificationQueue();
      setItems(r.items);
    } catch (e) {
      // This used to swallow the failure and leave an empty table with no
      // explanation — the exact shape of bug this page was fixed for.
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function approve(userId: string) {
    setError(null);
    try {
      await buildApi.adminApproveVerification(userId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reject(userId: string) {
    const reason = prompt("Reason for rejection (optional):") ?? undefined;
    setError(null);
    try {
      await buildApi.adminRejectVerification(userId, reason);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
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

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

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
