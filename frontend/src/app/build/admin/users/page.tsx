"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildAdminUser } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type UserRow = BuildAdminUser;

export default function AdminUsersPage() {
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
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load(search: string) {
    if (!token || user?.role !== "ADMIN") return;
    setLoading(true);
    setErr(null);
    try {
      const r = await buildApi.adminListUsers({ search, limit: 100 });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, token, user]);

  if (user && user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        Only ADMIN accounts.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/build/admin" className="text-xs text-slate-400 hover:underline">← Admin</Link>
          <h1 className="mt-1 text-2xl font-bold text-white">Users</h1>
          <p className="text-xs text-slate-400">{total.toLocaleString("ru-RU")} total</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or name…"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {err && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {err}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full sm:min-w-[800px] text-left text-xs">
          <thead className="bg-white/5 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Name / Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Build role</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((u) => (
              <tr key={u.id} className="text-slate-200 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link
                    href={`/build/u/${encodeURIComponent(u.id)}`}
                    className="font-semibold text-white hover:text-emerald-200"
                  >
                    {u.name}
                  </Link>
                  <div className="text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                    u.role === "ADMIN" ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/5 text-slate-300"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{u.buildRole ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{u.city ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.openToWork && (
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">open</span>
                    )}
                    {u.verifiedAt && (
                      <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-200">verified</span>
                    )}
                    <button
                      disabled={toggling === u.id}
                      onClick={async () => {
                        setToggling(u.id);
                        setErr(null);
                        try {
                          if (u.verifiedAt) await buildApi.adminUnverifyUser(u.id);
                          else await buildApi.adminVerifyUser(u.id);
                          await load(q);
                        } catch (e) {
                          setErr((e as Error).message);
                        } finally {
                          setToggling(null);
                        }
                      }}
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase transition disabled:opacity-50 ${
                        u.verifiedAt
                          ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                          : "bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                      }`}
                    >
                      {u.verifiedAt ? "unverify" : "verify"}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
