"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { StarsDisplay } from "@/components/build/StarRating";

type Worker = {
  userId: string;
  name: string;
  city: string | null;
  buildRole: string;
  title: string | null;
  skillsJson: string;
  skills?: string[];
  experienceYears: number;
  photoUrl: string | null;
  availableNow: boolean;
  availableUntil: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  reviewCount: number;
  avgRating: number;
};

function timeLeft(until: string | null): string {
  if (!until) return "Сегодня";
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "Истекло";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `ещё ${h}ч ${m}м` : `ещё ${m}м`;
}

export default function AvailablePage() {
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await buildApi.availableWorkers({
        city: city || undefined,
        specialty: specialty || undefined,
        limit: 50,
      });
      const items = (r.items as unknown as Worker[]).map((w) => ({
        ...w,
        skills: typeof w.skillsJson === "string" ? JSON.parse(w.skillsJson) as string[] : (w.skills ?? []),
      }));
      setWorkers(items);
      setAsOf(r.asOf);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [city, specialty]);

  useEffect(() => {
    void load();
    // Auto-refresh every 60s — this is a live feed
    const id = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <BuildShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
              Available Now
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Специалисты готовые выйти на объект сегодня · обновляется каждую минуту
            </p>
          </div>
          <RequireAuth>
            <AvailabilityToggle onChanged={load} />
          </RequireAuth>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город (Алматы, Астана…)"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Специальность (сварщик, электрик…)"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={() => void load()}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
          >
            Обновить
          </button>
        </div>

        {/* Status */}
        {asOf && (
          <p className="text-xs text-slate-500">
            Обновлено: {new Date(asOf).toLocaleTimeString("ru")} · {workers.length} специалистов онлайн
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 animate-pulse rounded-xl border border-white/5 bg-white/5" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 text-slate-300">Сейчас нет доступных специалистов</p>
            <p className="mt-1 text-sm text-slate-500">Попробуйте убрать фильтры или зайдите позже</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((w) => (
              <Link
                key={w.userId}
                href={`/build/u/${w.userId}`}
                className="group relative flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-500/30 hover:bg-white/10"
              >
                {/* Available badge */}
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {timeLeft(w.availableUntil)}
                </div>

                {/* Identity */}
                <div className="flex items-center gap-3">
                  {w.photoUrl ? (
                    <img src={w.photoUrl} alt={w.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-white">
                      {w.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{w.name}</p>
                    <p className="truncate text-xs text-slate-400">{w.title || w.buildRole}</p>
                    {w.city && <p className="text-xs text-slate-500">📍 {w.city}</p>}
                  </div>
                </div>

                {/* Skills */}
                {(w.skills ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(w.skills ?? []).slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                        {s}
                      </span>
                    ))}
                    {(w.skills ?? []).length > 4 && (
                      <span className="text-[10px] text-slate-500">+{(w.skills ?? []).length - 4}</span>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{w.experienceYears > 0 ? `${w.experienceYears} лет опыта` : "Начинающий"}</span>
                  {w.reviewCount > 0 && (
                    <span className="flex items-center gap-1">
                      <StarsDisplay value={w.avgRating} />
                      <span>({w.reviewCount})</span>
                    </span>
                  )}
                </div>

                {/* Salary */}
                {(w.salaryMin || w.salaryMax) && (
                  <p className="text-xs font-medium text-emerald-300">
                    {w.salaryMin ? `от ${w.salaryMin.toLocaleString()}` : ""}
                    {w.salaryMax ? ` до ${w.salaryMax.toLocaleString()}` : ""}{" "}
                    {w.salaryCurrency || "RUB"}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </BuildShell>
  );
}

function AvailabilityToggle({ onChanged }: { onChanged: () => void }) {
  const token = useBuildAuth((s) => s.token);
  const [on, setOn] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const [hours, setHours] = useState(8);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    buildApi.myAvailability().then((r) => {
      const expired = r.availableUntil && new Date(r.availableUntil) < new Date();
      setOn(r.availableNow && !expired);
      setUntil(r.availableUntil);
    }).catch(() => {});
  }, [token]);

  async function toggle() {
    setBusy(true);
    try {
      const r = await buildApi.setAvailability(!on, hours);
      const expired = r.availableUntil && new Date(r.availableUntil) < new Date();
      setOn(r.availableNow && !expired);
      setUntil(r.availableUntil);
      onChanged();
    } catch {/**/}
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div>
        <p className="text-sm font-semibold text-white">Мой статус</p>
        {on && until && (
          <p className="text-xs text-emerald-400">{timeLeft(until)}</p>
        )}
      </div>
      {!on && (
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
        >
          {[2,4,8,12,24,48].map(h => (
            <option key={h} value={h}>{h}ч</option>
          ))}
        </select>
      )}
      <button
        disabled={busy}
        onClick={() => void toggle()}
        className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
          on
            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
            : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
        }`}
      >
        {busy ? "…" : on ? "Отключить" : "Я готов!"}
      </button>
    </div>
  );
}
