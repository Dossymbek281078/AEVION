"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app");

const LS_PROFILE = "aevion:healthai:profileId";

interface Exercise { type: string; frequency: string; minutes: number; }
interface DailyRoutine { wake: string; sleepTarget: string; waterL: number; meals: string[]; }
interface Nutrition { focus: string[]; avoid: string[]; sampleMeals: string[]; }

interface HealthPlan {
  goals: string[];
  dailyRoutine: DailyRoutine;
  weeklyExercise: Exercise[];
  nutrition: Nutrition;
  habitsToAdd: string[];
  habitsToReduce: string[];
  mentalHealth: string[];
  rationale: string[];
}

interface PlanResponse {
  plan: HealthPlan;
  snapshotId: string;
  bmi: number | null;
  avgSleep7d: number | null;
  avgMood7d: number | null;
  avgExercise7d: number | null;
  phq9: { score: number; severity: string } | null;
  gad7: { score: number; severity: string } | null;
  generatedAt: string;
  disclaimer: string;
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="font-bold text-white text-sm uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items, color = "text-slate-300" }: { items: string[]; color?: string }) {
  if (!items.length) return <p className="text-sm text-slate-600 italic">Нет данных</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={`text-sm ${color} flex gap-2 leading-relaxed`}>
          <span className="text-slate-600 shrink-0 mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScorePill({ label, score, severity, max }: { label: string; score: number; severity: string; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct < 37 ? "bg-emerald-500" : pct < 56 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-bold text-white ml-auto">{score}/{max}</span>
      <span className="text-xs text-slate-500">({severity})</span>
    </div>
  );
}

export default function HealthPlanPage() {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const pid = localStorage.getItem(LS_PROFILE);
    setProfileId(pid);
    if (!pid) { setLoading(false); return; }

    fetch(`${BACKEND}/api/healthai/plan/${encodeURIComponent(pid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📋</div>
          <p className="text-slate-400 text-sm">Генерируется план здоровья…</p>
        </div>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🏥</div>
          <h1 className="text-xl font-bold mb-2">Создайте профиль здоровья</h1>
          <p className="text-slate-400 text-sm mb-6">
            Для персонального плана здоровья нужно заполнить базовый профиль в HealthAI.
          </p>
          <Link
            href="/healthai"
            className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 rounded-xl font-semibold text-sm transition-colors"
          >
            → Создать профиль
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <Link href="/healthai" className="text-teal-400 underline text-sm">← HealthAI</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { plan, bmi, avgSleep7d, avgMood7d, avgExercise7d, phq9, gad7, generatedAt, disclaimer } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/healthai" className="text-slate-400 hover:text-white text-sm">← HealthAI</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">Персональный план здоровья</span>
        </div>
        <span className="text-xs text-slate-600">
          {new Date(generatedAt).toLocaleDateString("ru-RU")}
        </span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Metrics summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {bmi !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{bmi.toFixed(1)}</p>
              <p className="text-xs text-slate-500 mt-0.5">BMI</p>
            </div>
          )}
          {avgSleep7d !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{avgSleep7d.toFixed(1)}ч</p>
              <p className="text-xs text-slate-500 mt-0.5">Сон 7д</p>
            </div>
          )}
          {avgMood7d !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{avgMood7d.toFixed(1)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Настроение</p>
            </div>
          )}
          {avgExercise7d !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{Math.round(avgExercise7d)}мин</p>
              <p className="text-xs text-slate-500 mt-0.5">Активность</p>
            </div>
          )}
        </div>

        {/* Mental health scores */}
        {(phq9 || gad7) && (
          <div className="space-y-2">
            {phq9 && <ScorePill label="PHQ-9 (депрессия)" score={phq9.score} severity={phq9.severity} max={27} />}
            {gad7 && <ScorePill label="GAD-7 (тревожность)" score={gad7.score} severity={gad7.severity} max={21} />}
          </div>
        )}
        {!phq9 && !gad7 && (
          <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500">
              Пройдите{" "}
              <Link href="/healthai/screener" className="text-violet-400 underline">
                PHQ-9 и GAD-7 скрининг
              </Link>{" "}
              для учёта психологического здоровья в плане
            </p>
          </div>
        )}

        {/* Goals */}
        <Section icon="🎯" title="Цели">
          <BulletList items={plan.goals} color="text-teal-300" />
        </Section>

        {/* Daily routine */}
        <Section icon="🌅" title="Режим дня">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-white">{plan.dailyRoutine.wake}</p>
              <p className="text-xs text-slate-500">Подъём</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-white">{plan.dailyRoutine.waterL}л</p>
              <p className="text-xs text-slate-500">Вода/день</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <p className="text-xs font-bold text-white leading-tight">{plan.dailyRoutine.sleepTarget}</p>
              <p className="text-xs text-slate-500 mt-0.5">Сон</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Примерное меню</p>
          <BulletList items={plan.dailyRoutine.meals} />
        </Section>

        {/* Exercise */}
        <Section icon="🏃" title="Тренировки">
          <div className="space-y-2">
            {plan.weeklyExercise.map((ex, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2.5">
                <span className="text-sm text-slate-200">{ex.type}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-teal-400 font-semibold">{ex.frequency}</span>
                  <span className="text-xs text-slate-600">{ex.minutes} мин</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Nutrition */}
        <Section icon="🥗" title="Питание">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">Включить</p>
              <BulletList items={plan.nutrition.focus} color="text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Сократить</p>
              <BulletList items={plan.nutrition.avoid} color="text-red-300" />
            </div>
          </div>
        </Section>

        {/* Habits */}
        <Section icon="✅" title="Привычки">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Добавить</p>
              <BulletList items={plan.habitsToAdd} color="text-blue-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">Убрать</p>
              <BulletList items={plan.habitsToReduce} color="text-orange-300" />
            </div>
          </div>
        </Section>

        {/* Mental health */}
        {plan.mentalHealth.length > 0 && (
          <Section icon="🧘" title="Психологическое здоровье">
            <BulletList items={plan.mentalHealth} color="text-violet-300" />
          </Section>
        )}

        {/* Rationale */}
        {plan.rationale.length > 0 && (
          <details className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 font-semibold uppercase tracking-wider">
              📊 Почему такие рекомендации
            </summary>
            <div className="mt-3">
              <BulletList items={plan.rationale} color="text-slate-400" />
            </div>
          </details>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-slate-600 text-center leading-relaxed pb-4">{disclaimer}</p>

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/healthai/screener"
            className="py-3 bg-violet-900/40 hover:bg-violet-900/60 border border-violet-800/40 rounded-xl text-sm font-semibold text-center text-violet-300 transition-colors"
          >
            🧠 Скрининг
          </Link>
          <Link
            href="/healthai"
            className="py-3 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-800/40 rounded-xl text-sm font-semibold text-center text-teal-300 transition-colors"
          >
            📊 Мой дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
