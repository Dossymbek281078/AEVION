"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://api.aevion.app");

const LS_PROFILE = "aevion:healthai:profileId";

interface PopData {
  sample: number;
  usedBaseline: boolean;
  population: { sleepHours: number; moodScore: number; bmi: number; exerciseMin: number };
  self: { sleepHours: number | null; moodScore: number | null; bmi: number | null; exerciseMin: number | null };
  delta: { sleepHours: number | null; moodScore: number | null; bmi: number | null; exerciseMin: number | null };
}

interface MetricRow {
  key: keyof PopData["self"];
  label: string;
  unit: string;
  icon: string;
  higherBetter: boolean;
  popLabel: string;
  selfLabel: string;
}

const METRICS: MetricRow[] = [
  { key: "sleepHours",  label: "Сон",           unit: "ч",   icon: "😴", higherBetter: true,  popLabel: "часов/ночь", selfLabel: "ваш средний" },
  { key: "moodScore",   label: "Настроение",    unit: "/10", icon: "😊", higherBetter: true,  popLabel: "из 10", selfLabel: "ваш средний" },
  { key: "exerciseMin", label: "Активность",    unit: "мин", icon: "🏃", higherBetter: true,  popLabel: "мин/день", selfLabel: "ваш средний" },
  { key: "bmi",         label: "BMI",           unit: "",    icon: "⚖️", higherBetter: false, popLabel: "индекс массы тела", selfLabel: "ваш BMI" },
];

function DeltaBadge({ delta, higherBetter }: { delta: number | null; higherBetter: boolean }) {
  if (delta == null) return <span className="text-slate-600 text-xs">нет данных</span>;
  const positive = delta > 0;
  const good = higherBetter ? positive : !positive;
  const abs = Math.abs(delta).toFixed(1);
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      good ? "bg-emerald-900/40 text-emerald-300" : delta === 0 ? "bg-slate-800 text-slate-400" : "bg-amber-900/40 text-amber-300"
    }`}>
      {positive ? "+" : ""}{abs} {good ? "▲ лучше" : delta === 0 ? "= норма" : "▼ ниже"}
    </span>
  );
}

function MetricCard({ metric, data }: { metric: MetricRow; data: PopData }) {
  const pop = data.population[metric.key];
  const self = data.self[metric.key];
  const delta = data.delta[metric.key];
  const pct = self != null && pop > 0 ? Math.min(100, Math.round((self / pop) * 100)) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{metric.icon}</span>
        <h3 className="text-sm font-bold text-white">{metric.label}</h3>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{metric.selfLabel}</p>
          <p className="text-2xl font-black text-white">
            {self != null ? `${self}${metric.unit}` : "—"}
          </p>
        </div>
        <div className="text-right flex-1">
          <p className="text-xs text-slate-500 mb-0.5">среднее</p>
          <p className="text-lg font-bold text-slate-400">
            {pop}{metric.unit}
          </p>
        </div>
      </div>
      {pct != null && (
        <div className="mb-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                metric.higherBetter
                  ? pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-teal-500" : "bg-amber-500"
                  : pct <= 100 ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}
      <DeltaBadge delta={delta} higherBetter={metric.higherBetter} />
    </div>
  );
}

export default function PopulationPage() {
  const [data, setData] = useState<PopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem(LS_PROFILE);
    if (!pid) { setNoProfile(true); setLoading(false); return; }
    fetch(`${BACKEND}/api/healthai/population/${encodeURIComponent(pid)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (noProfile) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">📊</div>
        <h1 className="text-xl font-bold mb-2">Нет профиля</h1>
        <Link href="/healthai" className="text-violet-400 underline text-sm">→ Создать профиль</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/healthai" className="text-slate-400 hover:text-white text-sm">← HealthAI</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Сравнение со сверстниками</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Как вы в сравнении с другими</h1>
          {data && (
            <p className="text-slate-400 text-sm mt-1">
              {data.usedBaseline
                ? "Данные пользователей пока собираются — показываем научные нормы (ВОЗ)"
                : `На основе ${data.sample} профилей платформы`
              }
            </p>
          )}
        </div>

        {loading && <div className="text-center py-16 text-slate-500 animate-pulse text-sm">Вычисление статистики…</div>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {METRICS.map((m) => (
                <MetricCard key={m.key} metric={m} data={data} />
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Интерпретация</h2>
              <div className="space-y-2 text-sm text-slate-300">
                {data.delta.sleepHours != null && data.delta.sleepHours < -0.5 && (
                  <p className="text-amber-300">😴 Спите на {Math.abs(data.delta.sleepHours)}ч меньше нормы — хронический недосып повышает риски метаболических заболеваний</p>
                )}
                {data.delta.sleepHours != null && data.delta.sleepHours >= 0.5 && (
                  <p className="text-emerald-300">😴 Ваш сон выше среднего — отличная база для восстановления</p>
                )}
                {data.delta.moodScore != null && data.delta.moodScore < -1 && (
                  <p className="text-amber-300">😊 Настроение ниже среднего — пройдите <Link href="/healthai/screener" className="underline text-violet-400">PHQ-9 скрининг</Link></p>
                )}
                {data.delta.bmi != null && data.delta.bmi > 2 && (
                  <p className="text-amber-300">⚖️ BMI выше среднего — ознакомьтесь с рекомендациями в <Link href="/healthai/plan" className="underline text-violet-400">плане здоровья</Link></p>
                )}
                {data.delta.exerciseMin != null && data.delta.exerciseMin < -10 && (
                  <p className="text-amber-300">🏃 Активность ниже нормы — добавьте 15+ мин прогулки ежедневно</p>
                )}
                {Object.values(data.delta).every((d) => d == null) && (
                  <p className="text-slate-500">Начните логировать данные ежедневно чтобы видеть сравнение</p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center mt-4">
              Сравнение анонимизировано. Не является медицинской консультацией.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
