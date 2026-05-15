"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type TeamRequest = {
  id: string;
  title: string;
  description: string;
  rolesJson: string;
  city: string | null;
  clientName: string | null;
  applicantCount: number;
  createdAt: string;
};

type Role = { specialty: string; count: number; salary: number | null };

export default function TeamRequestsPage() {
  const token = useBuildAuth((s) => s.token);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    buildApi.teamRequests({ limit: 30 })
      .then((r) => setRequests(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <BuildShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">👷 Найм бригады</h1>
            <p className="mt-1 text-sm text-slate-400">
              Одним запросом — целая команда. Укажите нужные роли и найдите бригаду.
            </p>
          </div>
          {token && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-400"
            >
              + Найти бригаду
            </button>
          )}
        </div>

        {showCreate && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <CreateTeamForm onCreated={() => { setShowCreate(false); load(); }} />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-white/5 bg-white/5" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-4xl">👷</p>
            <p className="mt-3 text-slate-300">Пока нет запросов на бригаду</p>
            {token && (
              <button onClick={() => setShowCreate(true)} className="mt-4 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200">
                Создать первый запрос
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => {
              const roles: Role[] = JSON.parse(r.rolesJson || "[]");
              return (
                <Link
                  key={r.id}
                  href={`/build/team-requests/${r.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-500/30 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white">{r.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {r.clientName} {r.city && `· 📍 ${r.city}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {r.applicantCount} откликов
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 line-clamp-2">{r.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {roles.map((role, i) => (
                      <span key={i} className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200">
                        {role.count}× {role.specialty}
                        {role.salary ? ` · ${role.salary.toLocaleString()}₽` : ""}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString("ru")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </BuildShell>
  );
}

function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [roles, setRoles] = useState([{ specialty: "", count: 1, salary: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRole() { setRoles((r) => [...r, { specialty: "", count: 1, salary: "" }]); }
  function removeRole(i: number) { setRoles((r) => r.filter((_, j) => j !== i)); }
  function updateRole(i: number, field: string, value: string | number) {
    setRoles((r) => r.map((role, j) => j === i ? { ...role, [field]: value } : role));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const validRoles = roles
        .filter((r) => r.specialty.trim())
        .map((r) => ({
          specialty: r.specialty.trim(),
          count: Number(r.count) || 1,
          salary: r.salary ? Number(r.salary) : null,
        }));
      if (validRoles.length === 0) { setError("Добавьте хотя бы одну роль"); return; }
      await buildApi.createTeamRequest({
        title, description, roles: validRoles,
        city: city || undefined,
        startDate: startDate || undefined,
      });
      onCreated();
    } catch {
      setError("Ошибка создания запроса");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 text-sm">
      <h3 className="font-semibold text-white">Создать запрос на бригаду</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название объекта / работ *" required className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание задачи, сроки, условия *" required rows={3} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
      <div className="grid grid-cols-2 gap-3">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
        <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Дата начала (дд.мм.гггг)" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400 uppercase">Нужные роли</p>
        {roles.map((role, i) => (
          <div key={i} className="flex gap-2">
            <input value={role.specialty} onChange={(e) => updateRole(i, "specialty", e.target.value)} placeholder="Специальность *" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
            <input type="number" value={role.count} onChange={(e) => updateRole(i, "count", e.target.value)} min={1} max={99} placeholder="Кол-во" className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" />
            <input value={role.salary} onChange={(e) => updateRole(i, "salary", e.target.value)} placeholder="Зарплата ₽" className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
            {roles.length > 1 && (
              <button type="button" onClick={() => removeRole(i)} className="px-2 text-rose-400 hover:text-rose-300">×</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addRole} className="text-xs text-emerald-400 hover:text-emerald-300">+ Добавить роль</button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-500 px-5 py-2 font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? "…" : "Опубликовать запрос"}
        </button>
        <button type="button" onClick={onCreated} className="rounded-lg border border-white/10 px-4 py-2 text-slate-300">Отмена</button>
      </div>
    </form>
  );
}
