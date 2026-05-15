"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadSscBook,
  loadSscIndex,
  searchInBook,
  formatTenge,
  type SscRow,
  type SscBookMeta,
} from "../lib/ssc";

interface Props {
  /** Исходное название материала из seed (для prefill query). */
  seedName: string;
  seedUnit: string;
  /** Выбран ССЦ-код. */
  onPick: (row: SscRow & { bookSlug: string }) => void;
  /** Закрыть picker без выбора. */
  onClose: () => void;
  /** Кнопка «не нормируется» — пометить как skip. */
  onSkip?: () => void;
}

const PRIORITY_BOOKS = [
  "ssc-2025-almaty-book1-v2",
  "ssc-2025-almaty-book7-v2",
  "ssc-2025-common-book2-v2",
  "ssc-2025-common-book3-v2",
  "ssc-2025-common-book4-v2",
  "ssc-2025-common-book6-v2",
  "ssc-2025-09-common-book51",
];

const UNIT_EQ: Record<string, string> = {
  м3: "м³", "м³": "м3", м2: "м²", "м²": "м2",
  шт: "шт.", "шт.": "шт",
};

function unitsCompatible(a: string, b: string): boolean {
  if (!a || !b) return true;
  const an = a.trim().toLowerCase();
  const bn = b.trim().toLowerCase();
  if (an === bn) return true;
  return UNIT_EQ[an] === bn || UNIT_EQ[bn] === an;
}

/** Извлекаем 2-3 значимых слова для prefill. */
function extractQueryHint(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !/^\d+$/.test(t))
    .slice(0, 2)
    .join(" ");
}

export function SscPicker({ seedName, seedUnit, onPick, onClose, onSkip }: Props) {
  const [query, setQuery] = useState(() => extractQueryHint(seedName));
  const [results, setResults] = useState<Array<SscRow & { bookSlug: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [enforceUnit, setEnforceUnit] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced multi-book search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // Загружаем приоритетные книги параллельно (с кешем в lib/ssc)
        const books = await Promise.all(
          PRIORITY_BOOKS.map(async (slug) => {
            try {
              const b = await loadSscBook(slug);
              return { slug, rows: b.rows };
            } catch {
              return { slug, rows: [] };
            }
          }),
        );
        if (cancelled) return;
        const out: Array<SscRow & { bookSlug: string }> = [];
        for (const { slug, rows } of books) {
          for (const r of rows) {
            if (r.isGroup) continue;
            if (r.smetnaya == null) continue;
            if (enforceUnit && !unitsCompatible(seedUnit, r.unit)) continue;
            const ql = query.toLowerCase();
            if (
              r.name.toLowerCase().includes(ql) ||
              r.code.includes(query)
            ) {
              out.push({ ...r, bookSlug: slug });
              if (out.length > 200) break;
            }
          }
          if (out.length > 200) break;
        }
        setResults(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, seedUnit, enforceUnit]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-slate-900 text-white rounded-t-lg flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              Привязка к ССЦ-2025
            </div>
            <div className="text-sm font-semibold truncate" title={seedName}>
              {seedName}{" "}
              <span className="text-slate-400 font-normal">({seedUnit})</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b flex items-center gap-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по коду или наименованию ССЦ"
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={enforceUnit}
              onChange={(e) => setEnforceUnit(e.target.checked)}
            />
            строго ед. «{seedUnit}»
          </label>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="text-center text-xs text-slate-400 py-6">Поиск…</div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="text-center text-xs text-slate-400 py-6">
              Ничего не найдено. Попробуйте сократить запрос или снять ограничение по ед. изм.
            </div>
          )}
          {results.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-600 uppercase text-[10px]">
                  <th className="px-2 py-1.5 w-28">Код</th>
                  <th className="px-2 py-1.5">Наименование</th>
                  <th className="px-2 py-1.5 w-14">Ед.</th>
                  <th className="px-2 py-1.5 w-24 text-right">Сметная</th>
                  <th className="px-2 py-1.5 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={`${r.code}-${i}`}
                    className="border-t hover:bg-emerald-50/60"
                  >
                    <td className="px-2 py-1.5 font-mono text-slate-700">{r.code}</td>
                    <td className="px-2 py-1.5 text-slate-900">{r.name}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.unit}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700 tabular-nums font-semibold">
                      {formatTenge(r.smetnaya)}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => onPick(r)}
                        className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-semibold rounded hover:bg-emerald-700"
                      >
                        Привязать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-slate-50 rounded-b-lg flex items-center justify-between">
          {onSkip ? (
            <button
              onClick={onSkip}
              className="text-[11px] text-slate-500 hover:text-amber-700 underline"
              title="Материал не нормируется ССЦ — берётся фактически из счёта поставщика"
            >
              Пометить «не нормируется ССЦ»
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900"
          >
            Отмена (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
