"use client";

/**
 * Глобальный поиск по всем книгам ССЦ РК 8.04-08-2025.
 * Лениво грузит книги по очереди и собирает совпадения,
 * показывает прогресс (X / 93 книг просмотрено).
 *
 * Используется когда студент не знает в какой книге искать —
 * например «полистирол» может быть и в кн.1 (стройматериалы),
 * и в кн.6 (отделка), и быть разным по регионам.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadSscIndex,
  loadSscBook,
  formatTenge,
  bookLabel,
  REGION_LABELS,
  type SscBookMeta,
  type SscRow,
} from "../lib/ssc";

type Hit = SscRow & {
  bookSlug: string;
  bookLabel: string;
  regionSlug: string;
  regionLabel: string;
};

const MAX_HITS = 500;

export default function SscGlobalSearchPage() {
  const [index, setIndex] = useState<SscBookMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hits, setHits] = useState<Hit[]>([]);
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterBook, setFilterBook] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    loadSscIndex().then(setIndex).catch((e) => setError(String(e)));
  }, []);

  const regionsAvailable = useMemo(() => {
    if (!index) return [];
    const slugs = Array.from(new Set(index.map((b) => b.region_slug)));
    return slugs.map((slug) => ({ slug, label: REGION_LABELS[slug] ?? slug }));
  }, [index]);

  const booksAvailable = useMemo(() => {
    if (!index) return [];
    return Array.from(new Set(index.map((b) => b.book).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b, "ru", { numeric: true }),
    );
  }, [index]);

  async function runSearch() {
    if (!index || !query.trim()) return;
    cancelRef.current = false;
    setRunning(true);
    setHits([]);
    const q = query.trim().toLowerCase();
    const isCode = /^\d/.test(q);
    let books = index;
    if (filterRegion !== "all") books = books.filter((b) => b.region_slug === filterRegion);
    if (filterBook !== "all") books = books.filter((b) => b.book === filterBook);
    setProgress({ done: 0, total: books.length });

    const accumulated: Hit[] = [];
    for (let i = 0; i < books.length; i += 1) {
      if (cancelRef.current) break;
      const meta = books[i];
      try {
        const book = await loadSscBook(meta.slug);
        const label = bookLabel(meta.book, meta.issue, meta.kind);
        const regionLabel = REGION_LABELS[meta.region_slug] ?? meta.region_slug;
        for (const r of book.rows) {
          if (r.isGroup) continue;
          const matched = isCode ? r.code.includes(q) : r.name.toLowerCase().includes(q);
          if (!matched) continue;
          accumulated.push({
            ...r,
            bookSlug: meta.slug,
            bookLabel: label,
            regionSlug: meta.region_slug,
            regionLabel,
          });
          if (accumulated.length >= MAX_HITS) break;
        }
      } catch (e) {
        // skip failed books quietly
      }
      setProgress({ done: i + 1, total: books.length });
      setHits([...accumulated]);
      if (accumulated.length >= MAX_HITS) break;
    }
    setRunning(false);
  }

  function cancel() {
    cancelRef.current = true;
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
              ← Главная
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Глобальный поиск ССЦ</h1>
            <p className="text-sm text-slate-600 mt-1">
              Ищет по всем книгам и регионам. Кодом (начните с цифры) — по шифру, иначе — по наименованию.
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
              href="/smeta-trainer/ssc-stats"
              className="px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              Статистика
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
            Ошибка загрузки индекса: {error}
          </div>
        )}

        {/* Контролы */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[11px] text-slate-500 mb-1">
                Запрос (наименование или код)
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !running && runSearch()}
                placeholder="например: цемент, плитка, 101-0001"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="block text-[11px] text-slate-500 mb-1">Регион</label>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="all">Все регионы</option>
                {regionsAvailable.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-[11px] text-slate-500 mb-1">Книга</label>
              <select
                value={filterBook}
                onChange={(e) => setFilterBook(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="all">Все книги</option>
                {booksAvailable.map((b) => (
                  <option key={b} value={b}>
                    Книга {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {!running && (
                <button
                  onClick={runSearch}
                  disabled={!query.trim() || !index}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  Искать
                </button>
              )}
              {running && (
                <button
                  onClick={cancel}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700"
                >
                  Стоп
                </button>
              )}
            </div>
          </div>

          {/* Прогресс */}
          {(running || progress.done > 0) && progress.total > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>
                  Просмотрено книг: {progress.done} / {progress.total}
                </span>
                <span>Найдено: {hits.length}{hits.length >= MAX_HITS ? ` (лимит ${MAX_HITS})` : ""}</span>
              </div>
              <div className="bg-slate-100 rounded h-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${running ? "bg-blue-500" : "bg-slate-400"}`}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Результаты */}
        {hits.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2 py-2 text-left w-28">Шифр</th>
                  <th className="px-2 py-2 text-left">Наименование</th>
                  <th className="px-2 py-2 text-center w-16">Ед.</th>
                  <th className="px-2 py-2 text-left w-40">Регион</th>
                  <th className="px-2 py-2 text-left w-32">Книга</th>
                  <th className="px-2 py-2 text-right w-28">Сметная, ₸</th>
                  <th className="px-2 py-2 text-right w-28">Отпускная, ₸</th>
                  <th className="px-2 py-2 text-center w-16"></th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h, i) => (
                  <tr key={`${h.bookSlug}-${h.code}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 font-mono text-slate-900">{h.code}</td>
                    <td className="px-2 py-1.5 text-slate-700">{h.name}</td>
                    <td className="px-2 py-1.5 text-center text-slate-600">{h.unit}</td>
                    <td className="px-2 py-1.5 text-slate-600">{h.regionLabel}</td>
                    <td className="px-2 py-1.5 text-slate-500 text-[10px]">{h.bookLabel}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                      {formatTenge(h.smetnaya)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                      {formatTenge(h.otpusknaya)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Link
                        href={`/smeta-trainer/ssc-compare/${encodeURIComponent(h.code)}`}
                        className="text-[10px] text-blue-600 hover:underline"
                        title="Сравнить цены этого шифра по всем регионам"
                      >
                        сравнить
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!running && hits.length === 0 && progress.done > 0 && (
          <div className="text-sm text-slate-500 italic mt-4">
            Ничего не найдено по запросу «{query}».
          </div>
        )}
      </div>
    </div>
  );
}
