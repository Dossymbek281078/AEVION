"use client";

import { useEffect, useState } from "react";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildSkillBadge } from "@/lib/build/api";

export default function SkillTestsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <SkillTestsBody />
      </RequireAuth>
    </BuildShell>
  );
}

type Test = { id: string; skill: string; title: string; description: string; passMark: number };
type Question = { q: string; options: string[] };

function SkillTestsBody() {
  const [tests, setTests] = useState<Test[] | null>(null);
  const [myBadges, setMyBadges] = useState<BuildSkillBadge[]>([]);
  const [active, setActive] = useState<{ test: Test; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([buildApi.skillTests(), buildApi.myBadges()])
      .then(([t, b]) => { setTests(t.items); setMyBadges(b.items); })
      .catch((e) => setErr((e as Error).message));
  }, []);

  async function startTest(skill: string) {
    setBusy(true);
    setResult(null);
    try {
      const t = await buildApi.skillTest(skill);
      const test = tests?.find((x) => x.skill === skill);
      if (!test) return;
      setActive({ test, questions: t.questions });
      setAnswers(new Array(t.questions.length).fill(-1));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function submitTest() {
    if (!active) return;
    if (answers.some((a) => a === -1)) { setErr("Ответьте на все вопросы"); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await buildApi.submitSkillTest(active.test.skill, answers);
      setResult(r);
      if (r.passed) {
        setMyBadges((prev) => [...prev.filter((b) => b.skill !== active.test.skill), { skill: active.test.skill, score: r.score, earnedAt: new Date().toISOString(), title: active.test.title }]);
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const badgeMap = new Map(myBadges.map((b) => [b.skill, b]));

  if (active && !result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{active.test.title}</h1>
          <button onClick={() => { setActive(null); setAnswers([]); }} className="text-xs text-slate-400 hover:text-slate-200">✕ Выйти</button>
        </div>
        <p className="mb-4 text-sm text-slate-400">Минимум {active.test.passMark}% для получения бейджа.</p>
        {err && <p className="mb-3 text-sm text-rose-300">{err}</p>}
        <div className="space-y-4">
          {active.questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm font-semibold text-white">
                {i + 1}. {q.q}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setAnswers((prev) => { const n = [...prev]; n[i] = j; return n; })}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      answers[i] === j
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/30"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Отвечено: {answers.filter((a) => a !== -1).length} / {active.questions.length}
          </span>
          <button
            disabled={busy || answers.some((a) => a === -1)}
            onClick={submitTest}
            className="rounded-lg bg-emerald-500 px-6 py-2 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Проверяю…" : "Сдать тест"}
          </button>
        </div>
      </div>
    );
  }

  if (result && active) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className={`mb-6 rounded-2xl border p-8 ${result.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
          <div className="text-5xl">{result.passed ? "🏅" : "😔"}</div>
          <h2 className="mt-3 text-2xl font-bold text-white">{result.passed ? "Бейдж получен!" : "Не прошли"}</h2>
          <p className="mt-1 text-slate-300">{active.test.title}</p>
          <div className="mt-4 text-3xl font-bold text-white">{result.score}%</div>
          <p className="text-sm text-slate-400">{result.correct} из {result.total} правильно · минимум {active.test.passMark}%</p>
          {!result.passed && (
            <p className="mt-2 text-sm text-slate-400">Можно попробовать снова через 24 часа.</p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setActive(null); setResult(null); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            К тестам
          </button>
          {!result.passed && (
            <button onClick={() => { setResult(null); setAnswers(new Array(active.questions.length).fill(-1)); }} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30">
              Попробовать снова
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">🏅 Проверка навыков</h1>
        <p className="mt-1 text-sm text-slate-400">
          Пройдите тест — получите верифицированный бейдж на профиль. Работодатель видит не просто слова, а подтверждённый результат.
        </p>
      </div>

      {myBadges.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">Мои бейджи</div>
          <div className="flex flex-wrap gap-2">
            {myBadges.map((b) => (
              <div key={b.skill} className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                <span>🏅</span>
                <span className="text-sm font-semibold text-emerald-200">{b.title || b.skill}</span>
                <span className="text-xs text-emerald-400">{b.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <p className="text-sm text-rose-300">{err}</p>}
      {tests === null && <p className="text-sm text-slate-500">Загружаю…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {tests?.map((t) => {
          const badge = badgeMap.get(t.skill);
          return (
            <div key={t.skill} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-white">{t.title}</div>
                  <p className="mt-1 text-xs text-slate-400">{t.description}</p>
                  <p className="mt-1 text-xs text-slate-500">Проходной балл: {t.passMark}%</p>
                </div>
                {badge && (
                  <div className="shrink-0 text-center">
                    <div className="text-2xl">🏅</div>
                    <div className="text-xs font-bold text-emerald-300">{badge.score}%</div>
                  </div>
                )}
              </div>
              <button
                disabled={busy}
                onClick={() => startTest(t.skill)}
                className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition ${
                  badge
                    ? "border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                } disabled:opacity-50`}
              >
                {badge ? "Пройти снова" : "Начать тест"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
