"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  listMatched,
  listUnmatched,
  materialMapMeta,
} from "../../lib/materialPrices";
import { formatTenge } from "../../lib/ssc";

type Tab = "matched" | "unmatched";

export default function SscMappingPage() {
  const [tab, setTab] = useState<Tab>("matched");
  const [query, setQuery] = useState("");

  const matched = listMatched();
  const unmatched = listUnmatched();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === "matched") {
      if (!q) return matched;
      return matched.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sscName.toLowerCase().includes(q) ||
          m.sscCode.includes(q),
      );
    }
    if (!q) return unmatched;
    return unmatched.filter((m) => m.name.toLowerCase().includes(q));
  }, [tab, query, matched, unmatched]);

  const coverage = Math.round((materialMapMeta.matched / materialMapMeta.total) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/ssc"
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            ← К справочнику ССЦ
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Привязка учебных материалов к ССЦ РК 8.04-08-2025
            </h1>
            <p className="text-[11px] text-slate-500">
              {materialMapMeta.total} уникальных материалов в учебных расценках ·{" "}
              <span className="text-emerald-600 font-semibold">
                {materialMapMeta.matched} сматчено
              </span>{" "}
              · {materialMapMeta.unmatched} требуют ручной привязки · покрытие {coverage}%
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("matched")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${
                  tab === "matched"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ✓ Сматчено · {matched.length}
              </button>
              <button
                onClick={() => setTab("unmatched")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${
                  tab === "unmatched"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ⚠ Без привязки · {unmatched.length}
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="border rounded px-3 py-1.5 text-sm w-64"
            />
          </div>

          <div className="overflow-auto border rounded">
            {tab === "matched" ? (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600 uppercase text-[10px]">
                    <th className="px-2 py-2">Материал в seed</th>
                    <th className="px-2 py-2 w-16">Ед.</th>
                    <th className="px-2 py-2 w-28">ССЦ-код</th>
                    <th className="px-2 py-2">Соответствие в ССЦ</th>
                    <th className="px-2 py-2 w-16 text-center">Скор</th>
                    <th className="px-2 py-2 w-28 text-right">Сметная</th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as ReturnType<typeof listMatched>).map((m, i) => (
                    <tr key={i} className="border-t hover:bg-emerald-50/40">
                      <td className="px-2 py-1.5 text-slate-900">{m.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">{m.unit}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-700">
                        {m.sscCode}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">{m.sscName}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            m.score >= 0.7
                              ? "bg-emerald-100 text-emerald-700"
                              : m.score >= 0.5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {m.score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                        {formatTenge(m.smetnaya)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600 uppercase text-[10px]">
                    <th className="px-2 py-2">Материал в seed</th>
                    <th className="px-2 py-2 w-16">Ед.</th>
                    <th className="px-2 py-2">Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as ReturnType<typeof listUnmatched>).map((m, i) => (
                    <tr key={i} className="border-t hover:bg-amber-50/40">
                      <td className="px-2 py-1.5 text-slate-900">{m.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">{m.unit}</td>
                      <td className="px-2 py-1.5 text-slate-400 text-[11px]">
                        Нет совпадения по названию + единице с порогом 0.35
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-3">
            Скор &lt; 0.5 — натянутый матч, требует ручной проверки.
            Сгенерировано {materialMapMeta.generatedAt}{" "}
            (raw-corpus/match-seed-to-ssc.py).
          </div>
        </div>
      </div>
    </div>
  );
}
