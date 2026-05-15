"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

interface ModelBenchmark {
  provider: string;
  model: string;
  speedScore: number;
  qualityScore: number;
  costScore: number;
  contextWindow: number;
}

interface BenchmarkData {
  models: ModelBenchmark[];
  lastUpdated: string;
  note: string;
}

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#8b5cf6",
  grok: "#ef4444",
};

const PROVIDER_ICON: Record<string, string> = {
  anthropic: "◈", openai: "◆", gemini: "◇", deepseek: "▣", grok: "✦",
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-white w-7 text-right">{value}</span>
    </div>
  );
}

export default function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"quality" | "speed" | "cost">("quality");

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/benchmarks"))
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = data
    ? [...data.models].sort((a, b) => {
        if (sort === "quality") return b.qualityScore - a.qualityScore;
        if (sort === "speed") return b.speedScore - a.speedScore;
        return b.costScore - a.costScore;
      })
    : [];

  const fmtCtx = (n: number) => n >= 1000000 ? `${n / 1000000}M` : n >= 1000 ? `${n / 1000}K` : String(n);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <Link href="/qcoreai" className="text-slate-400 hover:text-white text-sm">← QCoreAI</Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Model Benchmarks</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Сравнение моделей</h1>
          <p className="text-slate-400 text-sm mt-0.5">Скорость, качество и стоимость по внутренним тестам QCoreAI</p>
        </div>

        {loading && <div className="text-center py-16 text-slate-500 animate-pulse text-sm">Загрузка…</div>}

        {!loading && data && (
          <>
            {/* Sort tabs */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
              {([["quality", "🎯 Качество"], ["speed", "⚡ Скорость"], ["cost", "💰 Экономность"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sort === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {sorted.map((m, i) => {
                const color = PROVIDER_COLOR[m.provider] ?? "#64748b";
                const icon = PROVIDER_ICON[m.provider] ?? "○";
                return (
                  <div key={m.model} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ background: `${color}25`, color }}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-[10px] bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-700/40">🏆 #1</span>}
                          <p className="text-sm font-bold text-white truncate">{m.model}</p>
                        </div>
                        <p className="text-xs text-slate-500 capitalize">{m.provider} · {fmtCtx(m.contextWindow)} ctx</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Качество</p>
                        <ScoreBar value={m.qualityScore} color="#10b981" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Скорость</p>
                        <ScoreBar value={m.speedScore} color="#3b82f6" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Экономность</p>
                        <ScoreBar value={m.costScore} color="#f59e0b" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-600 text-center mt-4">
              {data.note} · Обновлено {data.lastUpdated}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
