"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type Role = { specialty: string; count: number; salary: number | null };
type Application = { id: string; userId: string; roleIndex: number; message: string | null; status: string; applicantName: string | null };
type TeamReq = {
  id: string;
  title: string;
  description: string;
  roles: Role[];
  city: string | null;
  clientName: string | null;
  applications: Application[];
  createdAt: string;
};

export default function TeamRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useBuildAuth((s) => s.user);
  const token = useBuildAuth((s) => s.token);
  const [req, setReq] = useState<TeamReq | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyRole, setApplyRole] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  function load() {
    buildApi.teamRequest(id).then(setReq).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (applyRole === null) return;
    setBusy(true);
    setError(null);
    try {
      await buildApi.applyToTeam(id, applyRole, message || undefined);
      setApplied(true);
      setApplyRole(null);
      load();
    } catch {
      setError("Ошибка отклика. Возможно вы уже откликнулись на эту роль.");
    } finally { setBusy(false); }
  }

  if (loading) return (
    <BuildShell>
      <div className="h-64 animate-pulse rounded-xl border border-white/5 bg-white/5" />
    </BuildShell>
  );

  if (!req) return (
    <BuildShell>
      <p className="text-slate-400">Запрос не найден.</p>
    </BuildShell>
  );

  const myApplied = req.applications.filter((a) => a.userId === user?.id);

  return (
    <BuildShell>
      <div className="space-y-6">
        <Link href="/build/team-requests" className="text-xs text-slate-400 hover:text-white">← Все запросы на бригаду</Link>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{req.title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {req.clientName} {req.city && `· 📍 ${req.city}`} · {new Date(req.createdAt).toLocaleDateString("ru")}
            </p>
          </div>
          <p className="text-slate-300">{req.description}</p>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Нужные роли</p>
            <div className="space-y-2">
              {req.roles.map((role, i) => {
                const appCount = req.applications.filter((a) => a.roleIndex === i).length;
                const alreadyApplied = myApplied.some((a) => a.roleIndex === i);
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{role.count}× {role.specialty}</p>
                      {role.salary && <p className="text-xs text-emerald-300">{role.salary.toLocaleString()} ₽</p>}
                      <p className="text-xs text-slate-500">{appCount} откликов</p>
                    </div>
                    {token && !alreadyApplied && (
                      <button
                        onClick={() => setApplyRole(i)}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/30"
                      >
                        Откликнуться
                      </button>
                    )}
                    {alreadyApplied && (
                      <span className="text-xs text-emerald-400">✓ Откликнулся</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply form */}
        {applyRole !== null && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h3 className="font-semibold text-white mb-3">
              Отклик на роль: {req.roles[applyRole]?.specialty}
            </h3>
            {applied ? (
              <p className="text-emerald-400 text-sm">✅ Отклик отправлен!</p>
            ) : (
              <form onSubmit={(e) => void apply(e)} className="space-y-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Расскажите о вашем опыте, когда готовы выйти…"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={busy} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
                    {busy ? "…" : "Отправить отклик"}
                  </button>
                  <button type="button" onClick={() => setApplyRole(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300">Отмена</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Applications (owner only) */}
        {req.applications.length > 0 && user && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300">Все отклики ({req.applications.length})</p>
            {req.applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {app.applicantName ?? "Пользователь"} → {req.roles[app.roleIndex]?.specialty}
                    </p>
                    {app.message && <p className="mt-1 text-xs text-slate-400">{app.message}</p>}
                  </div>
                  <Link
                    href={`/build/u/${app.userId}`}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20"
                  >
                    Профиль
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BuildShell>
  );
}
