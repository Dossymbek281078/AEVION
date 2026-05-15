"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IndexRow = {
  period: string;
  indexPct: number | null;
  coefficient: number | null;
  section: string | null;
};

type IndexFile = {
  version: string;
  title: string;
  approvedBy: string;
  effectiveFrom: string;
  supersedes: string;
  source: string;
  annual: IndexRow[];
  quarterly: IndexRow[];
};

export default function IndexesPage() {
  const [data, setData] = useState<IndexFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/normatives/indexes-2025.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="p-6 text-red-600 text-sm">Ошибка загрузки: {error}</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {data?.version ?? "НДЦС РК 8.04-07-2025"}
            </h1>
            <p className="text-[11px] text-slate-500">
              {data?.title ?? "Индексы стоимости для строительства"}
              {data?.effectiveFrom &&
                ` · действует с ${new Date(data.effectiveFrom).toLocaleDateString("ru-RU")}`}
            </p>
          </div>
        </div>
      </header>

      {!data && <div className="p-6 text-slate-400 text-sm">Загрузка…</div>}

      {data && (
        <div className="max-w-5xl mx-auto px-6 py-4 grid grid-cols-2 gap-4">
          <section className="bg-white border rounded-lg p-4">
            <div className="text-sm font-semibold text-slate-900 mb-3">
              Годовые индексы
              <span className="text-[11px] text-slate-400 font-normal ml-2">
                {data.annual.length} периодов
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 text-[10px] uppercase border-b">
                  <th className="py-1.5">Период</th>
                  <th className="py-1.5 text-right">% к пред.</th>
                  <th className="py-1.5 text-right">Коэффициент</th>
                </tr>
              </thead>
              <tbody>
                {data.annual.map((r, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-1.5 font-medium">{r.period}</td>
                    <td className="py-1.5 text-right text-slate-600 tabular-nums">
                      {r.indexPct?.toFixed(1) ?? "—"}
                    </td>
                    <td className="py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                      {r.coefficient?.toFixed(4) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bg-white border rounded-lg p-4">
            <div className="text-sm font-semibold text-slate-900 mb-3">
              Квартальные индексы
              <span className="text-[11px] text-slate-400 font-normal ml-2">
                {data.quarterly.length} периодов
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 text-[10px] uppercase border-b">
                  <th className="py-1.5">Период</th>
                  <th className="py-1.5 text-right">% к пред.</th>
                  <th className="py-1.5 text-right">Коэффициент</th>
                </tr>
              </thead>
              <tbody>
                {data.quarterly.map((r, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-1.5 font-medium">{r.period}</td>
                    <td className="py-1.5 text-right text-slate-600 tabular-nums">
                      {r.indexPct?.toFixed(2) ?? "—"}
                    </td>
                    <td className="py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                      {r.coefficient?.toFixed(4) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <div className="font-semibold mb-1">Как применять</div>
            Коэффициент пересчёта переводит базисную стоимость объекта (на 1 января
            2001 г.) в текущий уровень цен. Для сметы за III кв. 2025 г. коэффициент
            ≈ 7.103 × 1.0192 = ... (см. полный расчёт в курсе, урок 2.5).
            <div className="mt-1 text-[10px] text-amber-600">
              Источник: {data.approvedBy}. Заменяет: {data.supersedes}.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
