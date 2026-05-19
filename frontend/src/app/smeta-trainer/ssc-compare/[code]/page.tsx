"use client";

/**
 * Сравнение цен материала ССЦ между регионами РК.
 * URL: /smeta-trainer/ssc-compare/[code] (например /ssc-compare/101-0001).
 *
 * Грузит все книги (или фильтр по номеру книги), собирает позиции
 * с совпадающим code, группирует по региону, показывает таблицу
 * с min/max/medianценой + дельта от минимальной.
 *
 * Учебная ценность: показать студенту что один и тот же материал
 * может стоить в Атырау на 30-40% дороже чем в Алматы (логистика).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  loadSscIndex,
  loadSscBook,
  formatTenge,
  bookLabel,
  REGION_LABELS,
  type SscBookMeta,
  type SscRow,
} from "../../lib/ssc";

type RegionPrice = {
  regionSlug: string;
  regionLabel: string;
  bookSlug: string;
  bookLabel: string;
  row: SscRow;
};

export default function SscComparePage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const [index, setIndex] = useState<SscBookMeta[] | null>(null);
  const [running, setRunning] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [prices, setPrices] = useState<RegionPrice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const idx = await loadSscIndex();
        if (cancelled) return;
        setIndex(idx);
        // Книги «rates» — отсекаем общие и комбо-сборники
        const targets = idx.filter((b) => b.kind === "rates");
        setProgress({ done: 0, total: targets.length });
        const accumulated: RegionPrice[] = [];
        for (let i = 0; i < targets.length; i += 1) {
          if (cancelled) return;
          const meta = targets[i];
          try {
            const book = await loadSscBook(meta.slug);
            const label = bookLabel(meta.book, meta.issue, meta.kind);
            const regionLabel = REGION_LABELS[meta.region_slug] ?? meta.region_slug;
            for (const r of book.rows) {
              if (r.isGroup) continue;
              if (r.code === code) {
                accumulated.push({
                  regionSlug: meta.region_slug,
                  regionLabel,
                  bookSlug: meta.slug,
                  bookLabel: label,
                  row: r,
                });
              }
            }
          } catch (e) {
            // skip
          }
          setProgress({ done: i + 1, total: targets.length });
          setPrices([...accumulated]);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setRunning(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const stats = useMemo(() => {
    const withSmet = prices.filter((p) => p.row.smetnaya != null);
    if (withSmet.length === 0) return null;
    const vals = withSmet.map((p) => p.row.smetnaya as number);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { min, max, median, avg, count: vals.length, spread: ((max - min) / min) * 100 };
  }, [prices]);

  const sample = prices[0]?.row;

  // Сортировка по сметной цене asc, null в конец
  const sortedPrices = useMemo(() => {
    return [...prices].sort((a, b) => {
      const av = a.row.smetnaya;
      const bv = b.row.smetnaya;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv;
    });
  }, [prices]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer/ssc-search" className="text-xs text-blue-600 hover:underline">
              ← К поиску
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Сравнение цен по шифру{" "}
              <span className="font-mono text-blue-700">{code}</span>
            </h1>
            {sample && (
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-semibold">{sample.name}</span> ·{" "}
                <span className="text-slate-500">ед. изм. {sample.unit}</span>
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
            Ошибка: {error}
          </div>
        )}

        {/* Прогресс */}
        {running && progress.total > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Просмотрено книг: {progress.done} / {progress.total}</span>
              <span>Найдено упоминаний: {prices.length}</span>
            </div>
            <div className="bg-slate-100 rounded h-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Метрики */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Минимум" value={formatTenge(stats.min)} color="emerald" />
            <Metric label="Медиана" value={formatTenge(stats.median)} />
            <Metric label="Максимум" value={formatTenge(stats.max)} color="red" />
            <Metric label="Разброс" value={`${stats.spread.toFixed(1)}%`} hint={`по ${stats.count} регионам`} />
          </div>
        )}

        {/* Таблица */}
        {sortedPrices.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Регион</th>
                  <th className="px-3 py-2 text-left">Книга</th>
                  <th className="px-3 py-2 text-right w-32">Сметная цена</th>
                  <th className="px-3 py-2 text-right w-32">Отпускная</th>
                  <th className="px-3 py-2 text-right w-24">Δ от мин.</th>
                </tr>
              </thead>
              <tbody>
                {sortedPrices.map((p, i) => {
                  const delta =
                    p.row.smetnaya != null && stats
                      ? ((p.row.smetnaya - stats.min) / stats.min) * 100
                      : null;
                  return (
                    <tr key={`${p.bookSlug}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-800 font-medium">{p.regionLabel}</td>
                      <td className="px-3 py-2 text-slate-500 text-[10px]">{p.bookLabel}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">
                        {formatTenge(p.row.smetnaya)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {formatTenge(p.row.otpusknaya)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {delta == null ? "—" : delta === 0 ? "—" : `+${delta.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !running && (
            <div className="text-sm text-slate-500 italic">
              Материал с шифром «{code}» не найден ни в одной книге.
            </div>
          )
        )}

        {/* Учебная подсказка */}
        {stats && stats.spread > 20 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
            <strong>📚 На заметку:</strong> разброс цен ≥ 20% означает значительную региональную
            дельту — обычно за счёт логистики, наличия местного производителя или удалённости от
            ж/д. При сметном расчёте используйте цены{" "}
            <em>того региона</em>, в котором ведётся строительство, а не «среднюю по РК».
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  color = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  color?: "slate" | "emerald" | "red";
}) {
  const valueColor =
    color === "emerald" ? "text-emerald-700" : color === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-base font-bold mt-1 font-mono ${valueColor}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
