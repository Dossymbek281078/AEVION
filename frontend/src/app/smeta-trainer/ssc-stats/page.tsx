"use client";

/**
 * Дашборд ССЦ РК 8.04-08-2025 — обзор всей базы.
 * Показывает покрытие: сколько материалов в каждом регионе/книге,
 * объёмы данных, последние обновления.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  loadSscIndex,
  REGIONS,
  REGION_LABELS,
  BOOK_DESCRIPTIONS,
  type SscBookMeta,
} from "../lib/ssc";

export default function SscStatsPage() {
  const [index, setIndex] = useState<SscBookMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSscIndex().then(setIndex).catch((e) => setError(String(e)));
  }, []);

  const stats = useMemo(() => {
    if (!index) return null;
    const totalMaterials = index.reduce((s, b) => s + b.materials, 0);
    const totalRows = index.reduce((s, b) => s + b.rows, 0);
    const totalBytes = index.reduce((s, b) => s + b.size_bytes, 0);
    const regionMap = new Map<string, { books: number; materials: number; rows: number }>();
    const bookMap = new Map<string, { regions: number; materials: number }>();
    for (const it of index) {
      const r = regionMap.get(it.region_slug) ?? { books: 0, materials: 0, rows: 0 };
      r.books += 1;
      r.materials += it.materials;
      r.rows += it.rows;
      regionMap.set(it.region_slug, r);
      if (it.book) {
        const b = bookMap.get(it.book) ?? { regions: 0, materials: 0 };
        b.regions += 1;
        b.materials += it.materials;
        bookMap.set(it.book, b);
      }
    }
    const regions = REGIONS.map((r) => ({
      ...r,
      ...(regionMap.get(r.slug) ?? { books: 0, materials: 0, rows: 0 }),
    })).sort((a, b) => b.materials - a.materials);
    const common = regionMap.get("common");
    const books = Array.from(bookMap.entries())
      .map(([book, v]) => ({ book, ...v }))
      .sort((a, b) => a.book.localeCompare(b.book, "ru", { numeric: true }));
    const maxRegionMat = Math.max(1, ...regions.map((r) => r.materials));
    return { totalMaterials, totalRows, totalBytes, regions, common, books, maxRegionMat };
  }, [index]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
              ← Главная
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Статистика ССЦ РК 8.04-08-2025</h1>
            <p className="text-sm text-slate-600 mt-1">
              Покрытие нормативного сборника сметных цен по регионам и книгам.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link
              href="/smeta-trainer/ssc"
              className="px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              Каталог
            </Link>
            <Link
              href="/smeta-trainer/ssc-search"
              className="px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              Глобальный поиск
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
            Ошибка загрузки индекса: {error}
          </div>
        )}

        {!stats && !error && (
          <div className="text-sm text-slate-500">Загрузка индекса…</div>
        )}

        {stats && (
          <>
            {/* Метрики */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Metric label="Материалов" value={stats.totalMaterials.toLocaleString("ru-RU")} hint="всего записей" />
              <Metric label="Строк в книгах" value={stats.totalRows.toLocaleString("ru-RU")} hint="с группами и заголовками" />
              <Metric label="Книг" value={String(stats.regions.reduce((s, r) => s + r.books, 0) + (stats.common?.books ?? 0))} hint={`${REGIONS.length} регионов + общие`} />
              <Metric label="Объём данных" value={`${(stats.totalBytes / 1024 / 1024).toFixed(1)} МБ`} hint="JSON-cache" />
            </div>

            {/* Регионы */}
            <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <h2 className="text-base font-semibold text-slate-800 mb-3">Покрытие по регионам</h2>
              <div className="space-y-1">
                {stats.regions.map((r) => {
                  const pct = (r.materials / stats.maxRegionMat) * 100;
                  return (
                    <div key={r.slug} className="grid grid-cols-[180px_1fr_120px] gap-2 items-center text-xs">
                      <div className="text-slate-700 truncate" title={r.label}>
                        {r.isCity ? "🏙" : "🗺"} {r.label}
                      </div>
                      <div className="relative bg-slate-100 rounded h-4 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-slate-900">
                          {r.materials > 0 ? r.materials.toLocaleString("ru-RU") : "—"}
                        </div>
                      </div>
                      <div className="text-right text-slate-500 font-mono">
                        {r.books > 0 ? `${r.books} кн.` : "нет данных"}
                      </div>
                    </div>
                  );
                })}
                {stats.common && (
                  <div className="grid grid-cols-[180px_1fr_120px] gap-2 items-center text-xs pt-2 border-t border-slate-200 mt-2">
                    <div className="text-slate-700 italic">📘 {REGION_LABELS["common"]}</div>
                    <div className="text-slate-500 italic">общеприменимые нормы</div>
                    <div className="text-right text-slate-500 font-mono">{stats.common.books} кн.</div>
                  </div>
                )}
              </div>
            </section>

            {/* Книги */}
            <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <h2 className="text-base font-semibold text-slate-800 mb-3">Распределение по книгам</h2>
              <table className="w-full text-xs">
                <thead className="text-slate-500 text-left">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-2 w-16">№</th>
                    <th className="py-2 px-2">Название</th>
                    <th className="py-2 px-2 text-right w-32">Регионов</th>
                    <th className="py-2 px-2 text-right w-40">Материалов</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.books.map((b) => (
                    <tr key={b.book} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono text-slate-900">{b.book}</td>
                      <td className="py-2 px-2 text-slate-700">
                        {BOOK_DESCRIPTIONS[b.book] ?? `Книга ${b.book}`}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">{b.regions}</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700 font-semibold">
                        {b.materials.toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="text-[11px] text-slate-500 italic mt-4">
              Источник: ССЦ РК 8.04-08-2025 (нормативный сборник сметных цен МНЭ РК).
              Данные парсятся из официальных .docx ежемесячно (cron автообновления — см. workflow ksm).
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
