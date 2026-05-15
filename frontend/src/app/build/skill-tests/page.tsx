"use client";

import { useEffect, useState } from "react";
import { BuildShell } from "@/components/build/BuildShell";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/build/auth";

interface TestInfo {
  id: string; title: string; description: string; passingScore: number; questionCount: number;
}

interface Question { id: string; text: string; options: string[]; }
interface TestDetail { id: string; title: string; passingScore: number; questions: Question[]; }

interface Badge { id: string; testId: string; testTitle: string; score: number; passed: boolean; grantedAt: string; }

interface GradeResult {
  score: number; passed: boolean; passingScore: number;
  correct: number; total: number;
  feedback: { questionId: string; chosen: number; correct: number; isCorrect: boolean }[];
}

const TEST_ICONS: Record<string, string> = {
  welding: "🔥", concrete: "🏗", electrician: "⚡",
};

export default function SkillTestsPage() {
  const [tests, setTests] = useState<TestInfo[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [active, setActive] = useState<TestDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? getAuthToken() : null;

  useEffect(() => {
    fetch(apiUrl("/api/build/skill-tests"))
      .then((r) => r.json())
      .then((d) => setTests(d.data?.tests ?? d.tests ?? []))
      .catch(() => {});

    if (token) {
      fetch(apiUrl("/api/build/skill-badges/me"), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setBadges(d.data?.badges ?? d.badges ?? []))
        .catch(() => {});
    }
  }, [token]);

  async function startTest(id: string) {
    const r = await fetch(apiUrl(`/api/build/skill-tests/${id}`));
    const d = await r.json();
    const test = d.data?.test ?? d.test;
    setActive(test);
    setAnswers(new Array(test.questions.length).fill(-1));
    setResult(null);
    setError("");
  }

  async function submit() {
    if (!active || !token) return;
    if (answers.some((a) => a === -1)) { setError("Ответьте на все вопросы"); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch(apiUrl(`/api/build/skill-tests/${active.id}/submit`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка");
      const res = d.data ?? d;
      setResult(res);
      if (res.passed) {
        setBadges((prev) => {
          const exists = prev.find((b) => b.testId === active.id);
          if (exists) return prev.map((b) => b.testId === active.id ? { ...b, score: Math.max(b.score, res.score) } : b);
          return [...prev, { id: Date.now().toString(), testId: active.id, testTitle: active.title, score: res.score, passed: true, grantedAt: new Date().toISOString() }];
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  // Result screen
  if (result && active) {
    return (
      <BuildShell>
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className={`text-center mb-8 p-8 rounded-2xl border ${
            result.passed ? "bg-emerald-950/40 border-emerald-800/40" : "bg-red-950/40 border-red-800/40"
          }`}>
            <div className="text-5xl mb-3">{result.passed ? "🏅" : "📚"}</div>
            <h1 className="text-2xl font-black text-white mb-1">
              {result.passed ? "Тест пройден!" : "Попробуйте ещё раз"}
            </h1>
            <p className="text-4xl font-black mt-3" style={{ color: result.passed ? "#10b981" : "#ef4444" }}>
              {result.score}%
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {result.correct} из {result.total} правильных · Порог {result.passingScore}%
            </p>
            {result.passed && (
              <p className="text-emerald-400 text-sm font-semibold mt-3">✓ Значок «{active.title}» добавлен в профиль</p>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {active.questions.map((q, i) => {
              const fb = result.feedback.find((f) => f.questionId === q.id);
              return (
                <div key={q.id} className={`p-4 rounded-xl border ${
                  fb?.isCorrect ? "bg-emerald-950/20 border-emerald-800/30" : "bg-red-950/20 border-red-800/30"
                }`}>
                  <p className="text-sm font-medium text-white mb-2">{i + 1}. {q.text}</p>
                  <p className={`text-xs ${fb?.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                    {fb?.isCorrect ? "✓" : "✗"} Ваш ответ: {q.options[fb?.chosen ?? 0]}
                  </p>
                  {!fb?.isCorrect && (
                    <p className="text-xs text-emerald-400 mt-0.5">Правильно: {q.options[fb?.correct ?? 0]}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setActive(null); setResult(null); }}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-sm"
            >
              ← К тестам
            </button>
            {!result.passed && (
              <button
                onClick={() => { setAnswers(new Array(active.questions.length).fill(-1)); setResult(null); }}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm"
              >
                Попробовать снова
              </button>
            )}
          </div>
        </div>
      </BuildShell>
    );
  }

  // Quiz screen
  if (active) {
    const answered = answers.filter((a) => a !== -1).length;
    const progress = Math.round((answered / active.questions.length) * 100);

    return (
      <BuildShell>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setActive(null)} className="text-slate-400 hover:text-white text-sm">← Назад</button>
            <span className="text-xs text-slate-500">{answered}/{active.questions.length}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <h1 className="text-lg font-bold text-white mb-6">{TEST_ICONS[active.id] ?? "🎓"} {active.title}</h1>

          <div className="space-y-6">
            {active.questions.map((q, idx) => (
              <div key={q.id} className={`bg-slate-900 border rounded-xl p-5 ${answers[idx] !== -1 ? "border-slate-600" : "border-slate-800"}`}>
                <p className="text-sm font-medium text-white mb-3">
                  <span className="text-slate-500 mr-2">{idx + 1}.</span>{q.text}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((prev) => { const n = [...prev]; n[idx] = oi; return n; })}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        answers[idx] === oi
                          ? "bg-violet-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && <div className="mt-4 bg-red-900/30 border border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-300">{error}</div>}

          <button
            onClick={submit}
            disabled={submitting || answered < active.questions.length || !token}
            className="mt-6 w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
          >
            {!token ? "Войдите чтобы сдать тест" :
             submitting ? "Проверяем…" :
             answered < active.questions.length ? `Ответьте на все ${active.questions.length} вопросов` :
             "Сдать тест →"}
          </button>
          <p className="mt-2 text-xs text-slate-600 text-center">Порог сдачи: {active.passingScore}%</p>
        </div>
      </BuildShell>
    );
  }

  // List screen
  return (
    <BuildShell>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Тесты навыков</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Подтвердите свою компетентность — значки отображаются на вашем профиле
          </p>
        </div>

        {/* My badges */}
        {badges.length > 0 && (
          <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Мои значки</p>
            <div className="flex gap-2 flex-wrap">
              {badges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-800/40 rounded-xl px-3 py-2">
                  <span>{TEST_ICONS[b.testId] ?? "🏅"}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{b.testTitle}</p>
                    <p className="text-[10px] text-emerald-400">{b.score}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test cards */}
        <div className="space-y-3">
          {tests.map((t) => {
            const hasBadge = badges.some((b) => b.testId === t.id);
            return (
              <button
                key={t.id}
                onClick={() => startTest(t.id)}
                className="w-full text-left bg-slate-900 border border-slate-700 hover:border-violet-600/50 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{TEST_ICONS[t.id] ?? "🎓"}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-white">{t.title}</h2>
                      {hasBadge && <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/40">✓ Сдан</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">{t.questionCount} вопросов</p>
                    <p className="text-xs text-slate-500">Порог {t.passingScore}%</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BuildShell>
  );
}
