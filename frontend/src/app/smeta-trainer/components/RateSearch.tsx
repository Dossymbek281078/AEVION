"use client";

import { useMemo, useState } from "react";
import { searchRates } from "../lib/corpus";
import type { Rate } from "../lib/types";

interface Props {
  onPick: (rate: Rate) => void;
}

export function RateSearch({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRates(query, query.trim() ? 100 : 40), [query]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Поиск по шифру или тексту (например: окраск, ОТД-15)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="max-h-72 overflow-auto border border-slate-200 rounded">
        {results.length === 0 && (
          <div className="px-3 py-4 text-sm text-slate-500 text-center">Ничего не найдено</div>
        )}
        {results.map((r) => (
          <button
            key={r.code}
            onClick={() => onPick(r)}
            className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-b-0"
          >
            <div className="text-xs font-mono text-slate-500">{r.code}</div>
            <div className="text-sm font-medium text-slate-900">{r.title}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              ед. изм.: <span className="font-mono">{r.unit}</span> · базис: {r.baseCostPerUnit.toLocaleString("ru-RU")} ₸
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
