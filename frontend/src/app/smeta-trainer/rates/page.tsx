"use client";

/**
 * Каталог расценок ЭСН — полный обзор 499 единичных норм с поиском и фильтрами.
 *
 * Возможности:
 *   • Поиск по шифру и наименованию
 *   • Фильтры: категория, единица измерения, диапазон базовой цены
 *   • Сортировка: по шифру / алфавиту / цене (asc/desc)
 *   • Разворачиваемая карточка: composition + resources + baseCostPerUnit
 *   • Кликаемая категория → редирект на /lsr-editor с предзаполненным фильтром
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { rates as ALL_RATES } from "../lib/corpus";
import { formatKzt } from "../lib/calc";

type SortMode = "code" | "title" | "price-asc" | "price-desc";

const CATEGORY_LABELS: Record<string, string> = {
  "общестроительные": "Общестрой",
  "отделочные": "Отделочные",
  "сантехнические": "Сантехнические",
  "электромонтажные": "Электромонтаж",
  "монтаж-оборудования": "Монтаж оборудования",
  "земляные": "Земляные",
  "кровельные": "Кровельные",
  "демонтажные": "Демонтажные",
  "ремонтно-строительные": "Ремонтно-строит.",
};

const CATEGORY_COLOR: Record<string, string> = {
  "общестроительные": "bg-stone-100 text-stone-800",
  "отделочные": "bg-blue-100 text-blue-800",
  "сантехнические": "bg-cyan-100 text-cyan-800",
  "электромонтажные": "bg-yellow-100 text-yellow-800",
  "монтаж-оборудования": "bg-purple-100 text-purple-800",
  "земляные": "bg-orange-100 text-orange-800",
  "кровельные": "bg-sky-100 text-sky-800",
  "демонтажные": "bg-red-100 text-red-800",
  "ремонтно-строительные": "bg-emerald-100 text-emerald-800",
};

export default function RatesCatalogPage() {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("code");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // Доступные значения фильтров
  const categories = useMemo(
    () => Array.from(new Set(ALL_RATES.map((r) => r.category))).sort(),
    [],
  );
  const units = useMemo(
    () => Array.from(new Set(ALL_RATES.map((r) => r.unit))).sort(),
    [],
  );

  // Применяем все фильтры
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? parseFloat(minPrice) : -Infinity;
    const max = maxPrice ? parseFloat(maxPrice) : Infinity;
    const out = ALL_RATES.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (unitFilter !== "all" && r.unit !== unitFilter) return false;
      if (r.baseCostPerUnit < min || r.baseCostPerUnit > max) return false;
      if (q) {
        const codeMatch = r.code.toLowerCase().includes(q);
        const titleMatch = r.title.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch) return false;
      }
      return true;
    });
    // Сортировка
    switch (sort) {
      case "title":
        out.sort((a, b) => a.title.localeCompare(b.title, "ru"));
        break;
      case "price-asc":
        out.sort((a, b) => a.baseCostPerUnit - b.baseCostPerUnit);
        break;
      case "price-desc":
        out.sort((a, b) => b.baseCostPerUnit - a.baseCostPerUnit);
        break;
      default:
        out.sort((a, b) => a.code.localeCompare(b.code, "ru", { numeric: true }));
    }
    return out;
  }, [query, categoryFilter, unitFilter, minPrice, maxPrice, sort]);

  // Статистика по выборке
  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const prices = filtered.map((r) => r.baseCostPerUnit);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
      count: filtered.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg,
    };
  }, [filtered]);

  function reset() {
    setQuery("");
    setCategoryFilter("all");
    setUnitFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSort("code");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
              ← Главная
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              📋 Каталог расценок ЭСН
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {ALL_RATES.length} единичных норм РК в 9 категориях. Поиск, фильтры, разбор состава.
            </p>
          </div>
          <Link
            href="/smeta-trainer/calc"
            className="text-xs px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            🧮 Калькулятор →
          </Link>
        </div>

        {/* Фильтры */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Поиск
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Шифр или наименование (напр.: ОТД-13 или штукатурка)"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Категория
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="all">Все категории</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Ед. изм.
              </label>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="all">Все</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Сортировка
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="code">По шифру</option>
                <option value="title">По алфавиту</option>
                <option value="price-asc">Цена ↑</option>
                <option value="price-desc">Цена ↓</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
            <div className="md:col-span-3">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Цена от, ₸
              </label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm font-mono"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Цена до, ₸
              </label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="∞"
                className="w-full border border-slate-300 rounded px-2 py-2 text-sm font-mono"
              />
            </div>
            <div className="md:col-span-6 flex items-end gap-2">
              <button
                onClick={reset}
                className="px-3 py-2 text-xs border border-slate-300 rounded hover:bg-slate-100"
              >
                ✕ Сбросить
              </button>
              {stats && (
                <div className="text-xs text-slate-600 flex-1 text-right">
                  Найдено: <span className="font-bold">{stats.count}</span> · Цена:{" "}
                  <span className="font-mono">{formatKzt(stats.min)} … {formatKzt(stats.max)}</span> ·
                  Средняя: <span className="font-mono">{formatKzt(Math.round(stats.avg))}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Список расценок */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 italic">
              По заданным фильтрам ничего не найдено. Попробуйте сбросить.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2 py-2 text-left w-36">Шифр</th>
                  <th className="px-2 py-2 text-left">Наименование</th>
                  <th className="px-2 py-2 w-32">Категория</th>
                  <th className="px-2 py-2 text-center w-20">Ед.</th>
                  <th className="px-2 py-2 text-right w-32">Цена за ед.</th>
                  <th className="px-2 py-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => {
                  const expanded = expandedCode === r.code;
                  return (
                    <>
                      <tr
                        key={r.code}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedCode(expanded ? null : r.code)}
                      >
                        <td className="px-2 py-2 font-mono text-[10px] text-slate-900">{r.code}</td>
                        <td className="px-2 py-2 text-slate-800">{r.title}</td>
                        <td className="px-2 py-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CATEGORY_COLOR[r.category] ?? "bg-slate-100"}`}>
                            {CATEGORY_LABELS[r.category] ?? r.category}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-slate-600">{r.unit}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-emerald-700">
                          {formatKzt(r.baseCostPerUnit)}
                        </td>
                        <td className="px-2 py-2 text-center text-slate-400">
                          {expanded ? "▼" : "▶"}
                        </td>
                      </tr>
                      {expanded && <RateExpandedRow rate={r} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 500 && (
          <div className="text-xs text-slate-500 italic text-center mt-3">
            Показаны первые 500 из {filtered.length}. Уточните фильтр.
          </div>
        )}
      </div>
    </div>
  );
}

function RateExpandedRow({ rate }: { rate: typeof ALL_RATES[number] }) {
  // Группировка ресурсов по kind
  const grouped = {
    "труд": rate.resources.filter((r) => r.kind === "труд"),
    "машины": rate.resources.filter((r) => r.kind === "машины"),
    "материал": rate.resources.filter((r) => r.kind === "материал"),
  };

  return (
    <tr className="bg-slate-50">
      <td colSpan={6} className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          {/* Состав работ */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              📋 Состав работ
            </div>
            {rate.composition && rate.composition.length > 0 ? (
              <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                {rate.composition.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ) : (
              <div className="text-slate-400 italic">не задано</div>
            )}
            {(rate as any).esn_ref && (
              <div className="mt-2 text-[10px] text-slate-500 italic">
                📎 {(rate as any).esn_ref}
              </div>
            )}
            {rate.technicalNotes && (
              <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                💡 {rate.technicalNotes}
              </div>
            )}
          </div>

          {/* Ресурсы — труд + машины */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              💼🚜 Труд и машины
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                {[...grouped["труд"], ...grouped["машины"]].map((res, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 text-slate-700">{res.name}</td>
                    <td className="py-1 text-right font-mono text-slate-600">
                      {res.qtyPerUnit} {res.unit}
                    </td>
                  </tr>
                ))}
                {grouped["труд"].length + grouped["машины"].length === 0 && (
                  <tr><td className="text-slate-400 italic">не задано</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ресурсы — материалы */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              📦 Материалы
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                {grouped["материал"].map((res, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 text-slate-700">{res.name}</td>
                    <td className="py-1 text-right font-mono text-slate-600">
                      {res.qtyPerUnit} {res.unit}
                    </td>
                  </tr>
                ))}
                {grouped["материал"].length === 0 && (
                  <tr><td className="text-slate-400 italic">только труд/машины</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <div className="text-[10px] text-slate-500">
            Базовая стоимость единицы (без НР, СП, индексов)
          </div>
          <div className="text-base font-bold font-mono text-emerald-700">
            {formatKzt(rate.baseCostPerUnit)} за {rate.unit}
          </div>
        </div>
      </td>
    </tr>
  );
}
