"use client";

import { useState } from "react";
import Link from "next/link";

const BACKEND =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app";

const LS_PROFILE = "aevion:healthai:profileId";

// PHQ-9: 9 questions, depression screening
const PHQ9_Q = [
  "Потеря интереса или удовольствия от привычных дел",
  "Подавленность, депрессия или ощущение безнадёжности",
  "Проблемы со сном: сложно заснуть, частые пробуждения или, наоборот, слишком много сна",
  "Усталость или упадок сил",
  "Плохой аппетит или переедание",
  "Чувство вины, ощущение себя плохим человеком или неудачником",
  "Сложности с концентрацией: например, при чтении или просмотре ТВ",
  "Замедленность движений или речи; или, наоборот, суетливость/беспокойство",
  "Мысли о том, что лучше умереть, или желание причинить себе вред",
];

// GAD-7: 7 questions, anxiety screening
const GAD7_Q = [
  "Ощущение нервозности, тревоги или напряжённости",
  "Невозможность остановить или взять под контроль тревожные мысли",
  "Чрезмерное беспокойство по разным поводам",
  "Трудности с расслаблением",
  "Такое беспокойство, что трудно сидеть спокойно",
  "Лёгкая раздражительность или вспыльчивость",
  "Страх, что случится что-то ужасное",
];

const FREQ = [
  { v: 0, label: "Ни разу" },
  { v: 1, label: "Несколько дней" },
  { v: 2, label: "Больше половины дней" },
  { v: 3, label: "Почти каждый день" },
];

type ScreenerType = "phq9" | "gad7";

interface ScreenerResult {
  score: number;
  severity: string;
  advice: string;
  suicideFlag?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  minimal: "text-emerald-400",
  mild: "text-yellow-400",
  moderate: "text-orange-400",
  "moderately severe": "text-red-400",
  severe: "text-red-600",
};

const SEVERITY_RU: Record<string, string> = {
  minimal: "Минимальный",
  mild: "Лёгкий",
  moderate: "Умеренный",
  "moderately severe": "Умеренно тяжёлый",
  severe: "Тяжёлый",
};

export default function ScreenerPage() {
  const [activeTest, setActiveTest] = useState<ScreenerType | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState("");

  const questions = activeTest === "phq9" ? PHQ9_Q : activeTest === "gad7" ? GAD7_Q : [];
  const allAnswered = answers.length === questions.length && answers.every((a) => a !== undefined);

  function startTest(type: ScreenerType) {
    setActiveTest(type);
    setAnswers(new Array(type === "phq9" ? 9 : 7).fill(-1));
    setResult(null);
    setError("");
  }

  function setAnswer(idx: number, val: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  async function submitTest() {
    if (!activeTest || !allAnswered) return;
    setLoading(true);
    setError("");
    try {
      const profileId = localStorage.getItem(LS_PROFILE) ?? "guest-" + Date.now();
      const res = await fetch(`${BACKEND}/api/healthai/screener/${activeTest}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setActiveTest(null);
    setAnswers([]);
    setResult(null);
    setError("");
  }

  // ── Choose test ──────────────────────────────────────────────────────────
  if (!activeTest) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <Link href="/healthai" className="text-slate-400 hover:text-white text-sm">← HealthAI</Link>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">Психологический скрининг</span>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-black mb-2">Скрининг психического здоровья</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Стандартизированные тесты PHQ-9 и GAD-7 — международно признанные инструменты
              для первичной оценки депрессии и тревожности. Не заменяют консультацию специалиста.
            </p>
          </div>

          <div className="grid gap-4">
            {/* PHQ-9 */}
            <button
              onClick={() => startTest("phq9")}
              className="text-left p-6 bg-slate-900 border border-slate-700 hover:border-emerald-600/60 rounded-2xl transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 flex items-center justify-center text-2xl shrink-0">🧠</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-white">PHQ-9</h2>
                    <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">9 вопросов · ~2 мин</span>
                  </div>
                  <p className="text-sm text-slate-400">Шкала депрессии Patient Health Questionnaire. Используется в 70+ странах для скрининга большого депрессивного расстройства.</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {["0–4 Минимальный", "5–9 Лёгкий", "10–14 Умеренный", "15+ Тяжёлый"].map((l) => (
                      <span key={l} className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            {/* GAD-7 */}
            <button
              onClick={() => startTest("gad7")}
              className="text-left p-6 bg-slate-900 border border-slate-700 hover:border-violet-600/60 rounded-2xl transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-950 flex items-center justify-center text-2xl shrink-0">💭</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-white">GAD-7</h2>
                    <span className="text-xs bg-violet-900/40 text-violet-400 px-2 py-0.5 rounded-full">7 вопросов · ~1.5 мин</span>
                  </div>
                  <p className="text-sm text-slate-400">Generalized Anxiety Disorder scale. Золотой стандарт скрининга тревожного расстройства в первичной медицинской помощи.</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {["0–4 Минимальная", "5–9 Лёгкая", "10–14 Умеренная", "15+ Тяжёлая"].map((l) => (
                      <span key={l} className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          </div>

          <p className="mt-6 text-xs text-slate-600 text-center">
            Результаты не хранятся постоянно. Обратитесь к специалисту при высоком балле.
          </p>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (result) {
    const colorClass = SEVERITY_COLOR[result.severity] ?? "text-slate-300";
    const severityRu = SEVERITY_RU[result.severity] ?? result.severity;
    const maxScore = activeTest === "phq9" ? 27 : 21;
    const pct = Math.round((result.score / maxScore) * 100);

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <button onClick={reset} className="text-slate-400 hover:text-white text-sm">← Назад</button>
          <span className="text-slate-700">·</span>
          <span className="text-sm font-semibold">{activeTest === "phq9" ? "PHQ-9 — Результат" : "GAD-7 — Результат"}</span>
        </header>
        <div className="max-w-lg mx-auto px-6 py-10">
          {/* Score card */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-6 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={result.severity === "minimal" ? "#10b981" : result.severity === "mild" ? "#eab308" : result.severity === "moderate" ? "#f97316" : "#ef4444"}
                    strokeWidth="3"
                    strokeDasharray={`${pct} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-black ${colorClass}`}>{result.score}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{activeTest.toUpperCase()} Score</p>
                <p className={`text-2xl font-black ${colorClass}`}>{severityRu}</p>
                <p className="text-xs text-slate-500 mt-0.5">{result.score} из {maxScore} баллов</p>
              </div>
            </div>

            {/* Crisis alert */}
            {result.suicideFlag && (
              <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 mb-4">
                <p className="text-red-300 font-semibold text-sm mb-1">⚠ Обратитесь за помощью</p>
                <p className="text-red-400 text-xs">
                  Если у вас есть мысли о самоповреждении — пожалуйста, свяжитесь с кризисной линией:
                  Казахстан <strong>8-800-080-3838</strong> (бесплатно, круглосуточно).
                </p>
              </div>
            )}

            {/* Advice */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Рекомендации</p>
              <p className="text-sm text-slate-200 leading-relaxed">{result.advice}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => startTest(activeTest === "phq9" ? "gad7" : "phq9")}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Пройти {activeTest === "phq9" ? "GAD-7 (тревожность) →" : "PHQ-9 (депрессия) →"}
            </button>
            <Link
              href="/healthai"
              className="block w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-center transition-colors"
            >
              Перейти к плану здоровья →
            </Link>
            <button onClick={reset} className="w-full py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Пройти другой тест
            </button>
          </div>

          <p className="mt-6 text-xs text-slate-600 text-center">
            PHQ-9 и GAD-7 — образовательные инструменты. Результат не является медицинским диагнозом.
          </p>
        </div>
      </div>
    );
  }

  // ── Questionnaire ────────────────────────────────────────────────────────
  const testName = activeTest === "phq9" ? "PHQ-9" : "GAD-7";
  const answered = answers.filter((a) => a !== -1).length;
  const progress = Math.round((answered / questions.length) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={reset} className="text-slate-400 hover:text-white text-sm">← Назад</button>
            <span className="text-slate-700">·</span>
            <span className="text-sm font-semibold">{testName}</span>
          </div>
          <span className="text-xs text-slate-500">{answered}/{questions.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <p className="text-slate-400 text-sm mb-6">
          За последние <strong className="text-white">2 недели</strong> — как часто вас беспокоило следующее?
        </p>

        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={idx} className={`bg-slate-900 border rounded-xl p-5 transition-colors ${
              answers[idx] !== -1 ? "border-slate-600" : "border-slate-800"
            }`}>
              <p className="text-sm font-medium text-white mb-4">
                <span className="text-slate-500 mr-2">{idx + 1}.</span>{q}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FREQ.map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setAnswer(idx, v)}
                    className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      answers[idx] === v
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-900/50"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 sticky bottom-6">
          <button
            onClick={submitTest}
            disabled={!allAnswered || loading}
            className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-violet-900/40 transition-all"
          >
            {loading ? "Обработка..." : allAnswered ? `Получить результат ${testName} →` : `Ответьте на все ${questions.length} вопросов`}
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600 text-center pb-8">
          Не является медицинским диагнозом. При тяжёлых симптомах — обратитесь к врачу.
        </p>
      </div>
    </div>
  );
}
