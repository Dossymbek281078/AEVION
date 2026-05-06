"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  loadSscIndex,
  loadSscBook,
  searchInBook,
  formatTenge,
  bookLabel,
  REGIONS,
  REGION_LABELS,
  type SscBook,
  type SscBookMeta,
} from "../lib/ssc";

type GroupedBooks = Map<string, SscBookMeta[]>; // region_slug → книги

export default function SscReferencePage() {
  const [index, setIndex] = useState<SscBookMeta[] | null>(null);
  const [region, setRegion] = useState<string>("almaty");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [book, setBook] = useState<SscBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSscIndex().then(setIndex).catch((e) => setError(String(e)));
  }, []);

  // Группировка по региону
  const grouped: GroupedBooks = useMemo(() => {
    const m: GroupedBooks = new Map();
    if (!index) return m;
    for (const it of index) {
      const arr = m.get(it.region_slug) ?? [];
      arr.push(it);
      m.set(it.region_slug, arr);
    }
    // Сортируем книги внутри региона: по book asc, выпуск desc (последний первым)
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.kind === "general") return -1;
        if (b.kind === "general") return 1;
        const ba = a.book ?? "";
        const bb = b.book ?? "";
        if (ba !== bb) return ba.localeCompare(bb, "ru", { numeric: true });
        return (b.issue ?? 0) - (a.issue ?? 0);
      });
    }
    return m;
  }, [index]);

  const regionBooks = grouped.get(region) ?? [];
  const commonBooks = grouped.get("common") ?? [];

  // При смене активной книги — грузим
  useEffect(() => {
    if (!activeSlug) {
      setBook(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadSscBook(activeSlug)
      .then((b) => {
        setBook(b);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [activeSlug]);

  // При смене региона — выбираем первую региональную книгу
  useEffect(() => {
    if (regionBooks.length && !regionBooks.find((b) => b.slug === activeSlug)) {
      setActiveSlug(regionBooks[0].slug);
    }
  }, [region, regionBooks, activeSlug]);

  const filtered = useMemo(() => {
    if (!book) return [];
    return searchInBook(book, query, 300);
  }, [book, query]);

  const totalIndex = index?.length ?? 0;
  const totalMaterials = index?.reduce((s, i) => s + i.materials, 0) ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer"
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            ← К курсу
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              ССЦ РК 8.04-08-2025
            </h1>
            <p className="text-[11px] text-slate-500">
              Сметные цены на строительные материалы, изделия и конструкции ·{" "}
              {totalIndex} сборников · {totalMaterials.toLocaleString("ru-RU")}{" "}
              позиций
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-12 gap-4">
        {/* ── Левая колонка: регион + книги ────────────── */}
        <aside className="col-span-3 space-y-3">
          <div className="bg-white border rounded-lg p-3">
            <label className="text-[11px] font-semibold text-slate-500 uppercase">
              Регион
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full mt-1 border rounded px-2 py-1 text-sm"
            >
              <optgroup label="Города республиканского значения">
                {REGIONS.filter((r) => r.isCity).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Области">
                {REGIONS.filter((r) => !r.isCity).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="bg-white border rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
              Региональные книги
            </div>
            {regionBooks.length === 0 ? (
              <div className="text-xs text-slate-400">
                Нет книг для этого региона
              </div>
            ) : (
              <ul className="space-y-1">
                {regionBooks.map((b) => (
                  <li key={b.slug}>
                    <button
                      onClick={() => setActiveSlug(b.slug)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded ${
                        activeSlug === b.slug
                          ? "bg-emerald-100 text-emerald-900 font-semibold"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {bookLabel(b.book, b.issue, b.kind)}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {b.materials.toLocaleString("ru-RU")} позиций
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
              Общие книги (для всех регионов)
            </div>
            <ul className="space-y-1">
              {commonBooks.map((b) => (
                <li key={b.slug}>
                  <button
                    onClick={() => setActiveSlug(b.slug)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded ${
                      activeSlug === b.slug
                        ? "bg-emerald-100 text-emerald-900 font-semibold"
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    {bookLabel(b.book, b.issue, b.kind)}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {b.materials.toLocaleString("ru-RU")} позиций
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Правая колонка: позиции ──────────────────── */}
        <main className="col-span-9">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по коду или наименованию (например: 211-101 или щебень)"
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              {book && (
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {filtered.length} из{" "}
                  {book.rows.filter((r) => !r.isGroup).length}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">
                {error}
              </div>
            )}

            {!activeSlug && (
              <div className="text-center text-slate-400 py-12 text-sm">
                Выберите книгу слева
              </div>
            )}

            {loading && (
              <div className="text-center text-slate-400 py-12 text-sm">
                Загрузка…
              </div>
            )}

            {book && !loading && (
              <>
                <div className="text-[11px] text-slate-400 mb-2">
                  Источник: {book.source} ·{" "}
                  {book.region
                    ? REGION_LABELS[book.region_slug] ?? book.region_slug
                    : "Общая"}
                </div>
                <div className="overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-600 uppercase text-[10px]">
                        <th className="px-2 py-2 w-32">Код</th>
                        <th className="px-2 py-2">Наименование</th>
                        <th className="px-2 py-2 w-16">Ед.</th>
                        <th className="px-2 py-2 w-16 text-center">Класс</th>
                        <th className="px-2 py-2 w-20 text-right">Масса, кг</th>
                        <th className="px-2 py-2 w-28 text-right">Отпускная</th>
                        <th className="px-2 py-2 w-28 text-right">Сметная</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr
                          key={r.code}
                          className="border-t hover:bg-emerald-50/40"
                        >
                          <td className="px-2 py-1.5 font-mono text-slate-700">
                            {r.code}
                          </td>
                          <td className="px-2 py-1.5 text-slate-900">
                            {r.name}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600">
                            {r.unit}
                          </td>
                          <td className="px-2 py-1.5 text-center text-slate-500">
                            {r.cargoClass || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">
                            {r.grossKg ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">
                            {formatTenge(r.otpusknaya)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-emerald-700 tabular-nums font-semibold">
                            {formatTenge(r.smetnaya)}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-8 text-slate-400"
                          >
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                  «Сметная» = отпускная + транспортно-заготовительные расходы
                  (ТЗР). В смете применяется именно сметная цена.
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
