"use client";

import { useMemo, useState } from "react";
import { searchRates, rates } from "../lib/corpus";
import type { Rate } from "../lib/types";

interface Props {
  onPick: (rate: Rate) => void;
}

type Category = Rate["category"] | "все";

const CATEGORY_LABELS: Record<string, string> = {
  "все":                  "Все",
  "демонтажные":          "Демонтаж",
  "отделочные":           "Отделка",
  "общестроительные":     "Строит.",
  "кровельные":           "Кровля",
  "сантехнические":       "Сантех",
  "электромонтажные":     "Электро",
  "ремонтно-строительные":"Ремонт",
  "земляные":             "Земля",
  "монтаж-оборудования":  "Монтаж",
};

// Получаем уникальные категории из корпуса
const CATEGORIES: Category[] = ["все", ...Array.from(new Set(rates.map((r) => r.category)))];

export function RateSearch({ onPick }: Props) {
  const [query, setQuery]     = useState("");
  const [cat, setCat]         = useState<Category>("все");
  const [picked, setPicked]   = useState<string | null>(null);

  const results = useMemo(() => {
    const filtered = cat === "все" ? rates : rates.filter((r) => r.category === cat);
    if (!query.trim()) return filtered.slice(0, 40);
    const q = query.toLowerCase();
    return filtered.filter((r) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)).slice(0, 60);
  }, [query, cat]);

  function handlePick(r: Rate) {
    onPick(r);
    setPicked(r.code);
    setTimeout(() => setPicked(null), 1200);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Поиск */}
      <input
        type="text"
        placeholder="Поиск по шифру или тексту…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="px-2 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      {/* Фильтр категорий */}
      <div className="flex flex-wrap gap-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              cat === c
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
            }`}
          >
            {CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      {/* Счётчик */}
      <div className="text-[10px] text-slate-400">
        {results.length} расценок{cat !== "все" ? ` · ${CATEGORY_LABELS[cat] ?? cat}` : ""}
      </div>

      {/* Список расценок */}
      <div className="max-h-64 overflow-auto border border-slate-200 rounded bg-white">
        {results.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-400 text-center">Ничего не найдено</div>
        )}
        {results.map((r) => (
          <button
            key={r.code}
            onClick={() => handlePick(r)}
            className={`w-full text-left px-2 py-1.5 border-b border-slate-100 last:border-b-0 transition-colors ${
              picked === r.code
                ? "bg-emerald-50 border-emerald-100"
                : "hover:bg-emerald-50"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.code}</span>
              {picked === r.code && <span className="text-[10px] text-emerald-600 font-semibold">✓ добавлено</span>}
            </div>
            <div className="text-xs font-medium text-slate-900 leading-tight mt-0.5">{r.title}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {r.unit} · {r.baseCostPerUnit.toLocaleString("ru-RU")} ₸/ед.
              {r.technicalNotes && (
                <span className="text-amber-500 ml-1" title={r.technicalNotes}>⚠</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
