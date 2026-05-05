"use client";

import { useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type MatchResult = {
  score: number;
  label: string;
  strengths: string[];
  gaps: string[];
  tip: string;
};

type Tab = "match" | "cover";

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";

const SCORE_BG = (s: number) =>
  s >= 80 ? "bg-emerald-950/40 border-emerald-800/60" : s >= 50 ? "bg-amber-950/40 border-amber-800/60" : "bg-red-950/40 border-red-800/60";

export default function AiMatchPage() {
  const [tab, setTab] = useState<Tab>("match");
  const [profileText, setProfileText] = useState("");
  const [vacancyText, setVacancyText] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "concise">("professional");
  const [loading, setLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedCover, setCopiedCover] = useState(false);

  async function handleMatch() {
    if (!profileText.trim() || !vacancyText.trim()) {
      setError("Заполните оба поля"); return;
    }
    setLoading(true); setError(""); setMatchResult(null);
    try {
      const r = await buildApi.aiMatchVacancy({ profileText, vacancyText });
      setMatchResult(r.match);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally { setLoading(false); }
  }

  async function handleCoverLetter() {
    if (!profileText.trim() || !vacancyText.trim()) {
      setError("Заполните оба поля"); return;
    }
    setLoading(true); setError(""); setCoverLetter(null);
    try {
      const r = await buildApi.aiCoverLetter({ profileText, vacancyText, tone });
      setCoverLetter(r.coverLetter ?? r.letter ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally { setLoading(false); }
  }

  function copyLetter() {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter).then(() => {
      setCopiedCover(true);
      setTimeout(() => setCopiedCover(false), 2000);
    });
  }

  return (
    <BuildShell>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🤖</span>
            <h1 className="text-xl font-bold">AI Анализ вакансии</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Вставьте свой профиль и описание вакансии — AI оценит соответствие или напишет сопроводительное письмо.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
          {(["match", "cover"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "match" ? "📊 Оценить соответствие" : "✍️ Написать письмо"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Мой профиль / резюме
            </label>
            <textarea
              rows={6}
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder="Опыт: 7 лет в строительстве, отделочные работы. Специализация: штукатурка, плитка. Сертификат КНАУФ..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Описание вакансии
            </label>
            <textarea
              rows={6}
              value={vacancyText}
              onChange={(e) => setVacancyText(e.target.value)}
              placeholder="Ищем опытного штукатура для объекта в ЖК Алматы. Требования: опыт от 3 лет, умение работать машинной штукатуркой..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>
          {tab === "cover" && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Тон письма
              </label>
              <div className="flex gap-2">
                {(["professional", "friendly", "concise"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                      tone === t
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {t === "professional" ? "💼 Деловой" : t === "friendly" ? "😊 Дружелюбный" : "⚡ Краткий"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={tab === "match" ? handleMatch : handleCoverLetter}
          disabled={loading || !profileText.trim() || !vacancyText.trim()}
          className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors mb-6"
        >
          {loading
            ? "AI анализирует..."
            : tab === "match"
              ? "📊 Оценить соответствие"
              : "✍️ Написать сопроводительное письмо"}
        </button>

        {/* Match result */}
        {tab === "match" && matchResult && (
          <div className={`border rounded-2xl p-6 ${SCORE_BG(matchResult.score)}`}>
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black border-4 shrink-0"
                style={{ borderColor: SCORE_COLOR(matchResult.score), color: SCORE_COLOR(matchResult.score) }}
              >
                {matchResult.score}
              </div>
              <div>
                <p className="text-xl font-bold text-white">{matchResult.label}</p>
                <p className="text-slate-400 text-sm">Индекс соответствия AI</p>
              </div>
            </div>

            {matchResult.strengths.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">✅ Сильные стороны</h3>
                <ul className="space-y-1">
                  {matchResult.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-slate-200 flex gap-2">
                      <span className="text-emerald-500 shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {matchResult.gaps.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">⚠ Пробелы</h3>
                <ul className="space-y-1">
                  {matchResult.gaps.map((g, i) => (
                    <li key={i} className="text-sm text-slate-200 flex gap-2">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {matchResult.tip && (
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-1">💡 Совет</h3>
                <p className="text-sm text-slate-200">{matchResult.tip}</p>
              </div>
            )}

            <button
              onClick={() => { setTab("cover"); setCoverLetter(null); }}
              className="mt-4 w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              ✍️ Написать сопроводительное письмо для этой вакансии →
            </button>
          </div>
        )}

        {/* Cover letter result */}
        {tab === "cover" && coverLetter && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Сопроводительное письмо</h3>
              <button
                onClick={copyLetter}
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {copiedCover ? "✓ Скопировано" : "Копировать"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed font-sans">
              {coverLetter}
            </pre>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-600">
          <Link href="/build" className="hover:text-slate-400">← Назад</Link>
          <span>·</span>
          <span>AI на базе Claude · AEVION QBuild</span>
          <span>·</span>
          <span>10 запросов / 10 мин</span>
        </div>
      </div>
    </BuildShell>
  );
}
