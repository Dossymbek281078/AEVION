"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { apiUrl } from "@/lib/apiBase";

interface SalaryBand {
  sampleSize: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
  currency: string;
}

interface CityRow {
  city: string;
  vacancyCount: number;
  avgSalary: number | null;
}

interface SalaryStats {
  workerExpectations: SalaryBand;
  employerOffers: SalaryBand;
  topCities: CityRow[];
  query: { q: string | null; city: string | null };
  generatedAt: string;
}

const POPULAR = ["Штукатур", "Сварщик", "Электрик", "Плотник", "Прораб", "Монтажник", "Маляр", "Каменщик"];

function fmt(n: number | null, currency = "RUB"): string {
  if (n == null) return "—";
  const sym = currency === "KZT" ? "₸" : currency === "USD" ? "$" : "₽";
  return n.toLocaleString("ru-RU") + " " + sym;
}

function PercentileBar({ band }: { band: SalaryBand }) {
  if (!band.p25 || !band.p50 || !band.p75) return null;
  const { p25, p50, p75, min, max } = band;
  const lo = min ?? p25 * 0.7;
  const hi = max ?? p75 * 1.3;
  const range = hi - lo || 1;
  const pct = (v: number) => `${Math.round(((v - lo) / range) * 100)}%`;

  return (
    <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden mt-3">
      {/* IQR bar */}
      <div
        className="absolute h-full bg-violet-600/30"
        style={{ left: pct(p25), width: `${Math.round(((p75 - p25) / range) * 100)}%` }}
      />
      {/* Median line */}
      <div
        className="absolute h-full w-0.5 bg-violet-400"
        style={{ left: pct(p50) }}
      />
      {/* Labels */}
      <span className="absolute text-[10px] font-mono text-slate-400 top-0.5" style={{ left: pct(p25) }}>P25</span>
      <span className="absolute text-[10px] font-mono text-violet-300 font-bold top-0.5" style={{ left: `calc(${pct(p50)} - 8px)` }}>P50</span>
      <span className="absolute text-[10px] font-mono text-slate-400 top-0.5" style={{ left: `calc(${pct(p75)} - 24px)` }}>P75</span>
    </div>
  );
}

function BandCard({ title, band, accent }: { title: string; band: SalaryBand; accent: string }) {
  if (!band.sampleSize) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-400 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm">Данных пока нет</p>
      </div>
    );
  }
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 ${accent}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-slate-500">{band.sampleSize} источников</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">25-й %</p>
          <p className="text-sm font-bold text-slate-300">{fmt(band.p25, band.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Медиана</p>
          <p className="text-base font-black text-white">{fmt(band.p50, band.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">75-й %</p>
          <p className="text-sm font-bold text-slate-300">{fmt(band.p75, band.currency)}</p>
        </div>
      </div>
      <PercentileBar band={band} />
      <p className="mt-2 text-xs text-slate-600 text-right">
        {fmt(band.min, band.currency)} — {fmt(band.max, band.currency)}
      </p>
    </div>
  );
}

export default function SalaryPage() {
  const [data, setData] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (specialty = "", cityFilter = "") => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (specialty.trim()) params.set("q", specialty.trim());
      if (cityFilter.trim()) params.set("city", cityFilter.trim());
      const r = await fetch(apiUrl(`/api/build/salary-stats?${params}`));
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setData(j.data ?? j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    load(q, city);
  }

  return (
    <BuildShell>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">💰</span>
            <h1 className="text-xl font-bold">Зарплатная аналитика</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Реальные данные с платформы: ожидания специалистов + предложения работодателей.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={search} className="flex gap-2 mb-4">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Специальность: Штукатур, Сварщик..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город"
            className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            {loading ? "…" : "Найти"}
          </button>
        </form>

        {/* Popular chips */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {POPULAR.map((s) => (
            <button
              key={s}
              onClick={() => { setQ(s); load(s, city); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                q === s
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Загрузка данных…</div>
        )}

        {data && (
          <>
            {/* Context header */}
            {(data.query.q || data.query.city) && (
              <div className="mb-4 text-sm text-slate-400">
                Результаты для{" "}
                {[data.query.q && <strong key="q" className="text-white">«{data.query.q}»</strong>, data.query.city && `в ${data.query.city}`]
                  .filter(Boolean)
                  .reduce((a, b) => [a, " ", b] as React.ReactNode, [] as React.ReactNode)}
              </div>
            )}

            {/* Salary bands */}
            <div className="grid gap-4 mb-6">
              <BandCard
                title="Ожидания специалистов"
                band={data.workerExpectations}
                accent="border-violet-800/40"
              />
              <BandCard
                title="Предложения работодателей"
                band={data.employerOffers}
                accent="border-teal-800/40"
              />
            </div>

            {/* Gap analysis */}
            {data.workerExpectations.p50 && data.employerOffers.p50 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-bold text-slate-400 mb-3">📊 Сравнение медиан</h3>
                {(() => {
                  const wP50 = data.workerExpectations.p50!;
                  const eP50 = data.employerOffers.p50!;
                  const gap = eP50 - wP50;
                  const gapPct = Math.round((gap / wP50) * 100);
                  const cur = data.workerExpectations.currency;
                  return (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-500">Специалисты ждут</p>
                        <p className="text-lg font-black text-violet-300">{fmt(wP50, cur)}</p>
                      </div>
                      <div className="flex-1 text-center">
                        <p className={`text-sm font-bold ${gap >= 0 ? "text-teal-400" : "text-amber-400"}`}>
                          {gap >= 0 ? "+" : ""}{gapPct}%
                        </p>
                        <p className="text-xs text-slate-600">{gap >= 0 ? "рынок предлагает больше" : "рынок предлагает меньше"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500">Работодатели дают</p>
                        <p className="text-lg font-black text-teal-300">{fmt(eP50, cur)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Top cities */}
            {data.topCities.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-bold text-slate-400 mb-3">📍 Горячие рынки</h3>
                <div className="space-y-2">
                  {data.topCities.map((c, i) => (
                    <div key={c.city} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                        <button
                          onClick={() => { setCity(c.city); load(q, c.city); }}
                          className="text-sm text-slate-200 hover:text-violet-300 transition-colors"
                        >
                          {c.city}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{c.vacancyCount} вакансий</span>
                        {c.avgSalary && (
                          <span className="text-teal-400 font-semibold">
                            ø {fmt(c.avgSalary, data.employerOffers.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 text-center">
              Данные обновляются в реальном времени · {new Date(data.generatedAt).toLocaleString("ru-RU")}
            </p>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-600">
          <Link href="/build/vacancies" className="hover:text-slate-400">← Вакансии</Link>
          <Link href="/build" className="hover:text-slate-400">Главная QBuild</Link>
          <Link href="/build/stats" className="hover:text-slate-400">Статистика</Link>
        </div>
      </div>
    </BuildShell>
  );
}
