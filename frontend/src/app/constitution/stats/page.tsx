"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SLIDER_SHORT_LABELS, type Sliders } from "@/lib/constitution";

type RegimeStat = { id: string; name: string; n: number };
type DailyStat = { day: string; n: number };
type SliderAgg = {
  key: keyof Sliders;
  mean: number;
  histogram: number[]; // 5 buckets
};

type StatsResponse = {
  total: number;
  byRegime: RegimeStat[];
  daily: DailyStat[];
  sliders: SliderAgg[];
  storage: "postgres" | "memory";
};

export default function ConstitutionStatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        "/api-backend/api/planet/constitution-artifacts/stats",
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as StatsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <Link
            href="/constitution"
            className="text-[#d4af37] hover:underline text-sm"
          >
            ← Constitution
          </Link>
          <div className="flex items-baseline justify-between flex-wrap gap-2 mt-2">
            <h1 className="text-3xl md:text-4xl font-bold text-[#d4af37]">
              Constitution — Аналитика
            </h1>
            <Link
              href="/constitution/leaderboard"
              className="text-sm text-emerald-300 hover:underline"
            >
              Leaderboard →
            </Link>
          </div>
          <p className="text-[#9aa3c0] mt-2">
            Распределение сценариев по режимам, средние ползунки, динамика
            публикаций за 30 дней.
          </p>
          {data && (
            <div className="mt-2 text-xs text-[#9aa3c0]">
              Storage:{" "}
              <span
                className={
                  data.storage === "postgres"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {data.storage}
              </span>{" "}
              · Всего артефактов:{" "}
              <span className="text-[#d4af37] font-mono">{data.total}</span>
            </div>
          )}
        </header>

        {loading && (
          <div className="text-center text-[#9aa3c0] py-10">Загрузка…</div>
        )}

        {error && (
          <div className="text-rose-400 border border-rose-500/30 rounded p-4 bg-rose-500/5">
            Ошибка загрузки: {error}
          </div>
        )}

        {data && data.total === 0 && (
          <div className="text-center text-[#9aa3c0] py-10 border border-[#d4af37]/20 rounded">
            Пока нет данных. Опубликуй пару сценариев через{" "}
            <Link href="/constitution" className="text-[#d4af37] underline">
              /constitution
            </Link>{" "}
            → «🌍 Опубликовать на Planet».
          </div>
        )}

        {data && data.total > 0 && (
          <div className="space-y-6">
            <RegimeBarChart data={data.byRegime} total={data.total} />
            <SliderHistograms data={data.sliders} total={data.total} />
            <DailySparkline data={data.daily} />
          </div>
        )}
      </div>
    </div>
  );
}

function RegimeBarChart({
  data,
  total,
}: {
  data: RegimeStat[];
  total: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.n));
  return (
    <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-[#f5d27a] mb-1">
        Распределение по режимам
      </h2>
      <p className="text-xs text-[#9aa3c0] mb-4">
        Какие режимы пользователи строят чаще всего
      </p>
      <div className="space-y-1.5">
        {data.map((r) => {
          const pct = max > 0 ? (r.n / max) * 100 : 0;
          const share = total > 0 ? Math.round((r.n / total) * 100) : 0;
          return (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <div className="w-56 truncate" title={r.name}>
                {r.name}
              </div>
              <div className="flex-1 h-5 bg-[#050a1a] rounded relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#22d3ee] to-[#d4af37] rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-20 text-right font-mono text-xs text-[#9aa3c0]">
                {r.n} · {share}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SliderHistograms({
  data,
  total,
}: {
  data: SliderAgg[];
  total: number;
}) {
  return (
    <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-[#f5d27a] mb-1">
        Распределение ползунков
      </h2>
      <p className="text-xs text-[#9aa3c0] mb-4">
        Среднее значение и гистограмма (5 бакетов 0-19 / 20-39 / 40-59 / 60-79
        / 80-100) по {total} артефактам
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((s) => (
          <SliderHistogramCell key={s.key} agg={s} />
        ))}
      </div>
    </section>
  );
}

function SliderHistogramCell({ agg }: { agg: SliderAgg }) {
  const max = Math.max(...agg.histogram, 1);
  const W = 160;
  const H = 80;
  const barW = (W - 8) / 5;
  return (
    <div className="border border-[#d4af37]/15 rounded p-2 bg-[#050a1a]/40">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium">
          {SLIDER_SHORT_LABELS[agg.key as keyof Sliders]}
        </span>
        <span className="text-[#d4af37] font-mono text-sm">{agg.mean}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {agg.histogram.map((v, i) => {
          const h = (v / max) * (H - 18);
          const x = i * barW + 2;
          return (
            <g key={i}>
              <rect
                x={x}
                y={H - 14 - h}
                width={barW - 2}
                height={h}
                fill="#22d3ee"
                opacity={0.55}
                rx={2}
              />
              <text
                x={x + (barW - 2) / 2}
                y={H - 2}
                textAnchor="middle"
                fontSize="8"
                fill="#9aa3c0"
              >
                {i * 20}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DailySparkline({ data }: { data: DailyStat[] }) {
  if (data.length === 0) {
    return (
      <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[#f5d27a] mb-1">
          Динамика публикаций за 30 дней
        </h2>
        <p className="text-xs text-[#9aa3c0]">
          Пока нет данных за последние 30 дней
        </p>
      </section>
    );
  }
  const W = 800;
  const H = 140;
  const PAD = 30;
  const max = Math.max(...data.map((d) => d.n), 1);
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data
    .map((d, i) => {
      const x = PAD + i * step;
      const y = H - PAD - (d.n / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const total = data.reduce((a, b) => a + b.n, 0);
  return (
    <section className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-5">
      <div className="flex justify-between items-baseline flex-wrap gap-2 mb-1">
        <h2 className="text-lg font-semibold text-[#f5d27a]">
          Динамика публикаций — 30 дней
        </h2>
        <div className="text-sm text-[#9aa3c0]">
          Всего за период:{" "}
          <span className="text-[#d4af37] font-mono">{total}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="#d4af37"
          strokeOpacity={0.3}
        />
        <line
          x1={PAD}
          y1={PAD}
          x2={PAD}
          y2={H - PAD}
          stroke="#d4af37"
          strokeOpacity={0.3}
        />
        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth={2}
          points={points}
        />
        {data.map((d, i) => {
          const x = PAD + i * step;
          const y = H - PAD - (d.n / max) * innerH;
          return (
            <circle key={d.day} cx={x} cy={y} r={3} fill="#d4af37" />
          );
        })}
        <text
          x={PAD}
          y={H - PAD + 14}
          fontSize="9"
          fill="#9aa3c0"
        >
          {data[0]?.day}
        </text>
        <text
          x={W - PAD}
          y={H - PAD + 14}
          textAnchor="end"
          fontSize="9"
          fill="#9aa3c0"
        >
          {data[data.length - 1]?.day}
        </text>
        <text
          x={PAD - 4}
          y={PAD + 4}
          textAnchor="end"
          fontSize="9"
          fill="#9aa3c0"
        >
          {max}
        </text>
      </svg>
    </section>
  );
}
