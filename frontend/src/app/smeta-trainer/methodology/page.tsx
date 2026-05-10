"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TopSection = { num: string; title: string };
type Entry = { num: string; text: string; page: number };
type TableRec = {
  num: string;
  title: string;
  page: number;
  header: string[];
  rows: string[][];
};

type Methodology = {
  version: string;
  title: string;
  approvedBy: string;
  effectiveFrom: string;
  supersedes: string;
  source: string;
  topSections: TopSection[];
  entries: Entry[];
  tables: TableRec[];
};

export default function MethodologyPage() {
  const [data, setData] = useState<Methodology | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"text" | "tables">("text");

  useEffect(() => {
    fetch("/normatives/ssc-methodology-2025.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // Группировка entries по top-level номеру
  const grouped = useMemo(() => {
    if (!data) return new Map<string, Entry[]>();
    const m = new Map<string, Entry[]>();
    for (const e of data.entries) {
      const top = e.num.split(".")[0];
      const arr = m.get(top) ?? [];
      arr.push(e);
      m.set(top, arr);
    }
    return m;
  }, [data]);

  // Фильтр по поиску
  const filteredEntries = useMemo(() => {
    if (!data) return [] as Entry[];
    const q = query.trim().toLowerCase();
    if (!q) return data.entries;
    return data.entries.filter(
      (e) => e.text.toLowerCase().includes(q) || e.num.includes(query),
    );
  }, [data, query]);

  const filteredTables = useMemo(() => {
    if (!data) return [] as TableRec[];
    const q = query.trim().toLowerCase();
    if (!q) return data.tables;
    return data.tables.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.num.includes(query) ||
        t.rows.some((r) => r.some((c) => c.toLowerCase().includes(q))),
    );
  }, [data, query]);

  if (error) {
    return <div className="p-6 text-red-600 text-sm">Ошибка загрузки: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">
              Общие положения · ССЦ РК 8.04-08-2025
            </h1>
            <p className="text-[11px] text-slate-500">
              Методика применения сметных цен на стройматериалы
              {data && ` · ${data.entries.length} пунктов · ${data.tables.length} таблиц`}
            </p>
          </div>
        </div>
      </header>

      {!data && <div className="p-6 text-slate-400 text-sm">Загрузка…</div>}

      {data && (
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-12 gap-4">
          {/* Sidebar — навигация по топ-разделам */}
          <aside className="col-span-3">
            <div className="bg-white border rounded-lg p-3 sticky top-20">
              <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
                Разделы
              </div>
              <ul className="space-y-1">
                {data.topSections.map((s) => (
                  <li key={s.num}>
                    <a
                      href={`#sec-${s.num}`}
                      className="block text-xs text-slate-700 hover:text-emerald-700 hover:bg-slate-50 rounded px-2 py-1"
                    >
                      <span className="font-mono text-slate-400">{s.num}</span>{" "}
                      {s.title}
                      <span className="text-[10px] text-slate-400 ml-1">
                        · {(grouped.get(s.num) ?? []).length}п.
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] text-slate-400 border-t pt-2">
                Утв.: {data.approvedBy.split("№")[1]?.trim() || data.approvedBy}
              </div>
            </div>
          </aside>

          <main className="col-span-9 space-y-4">
            {/* Поиск + табы */}
            <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по методике (например: транспорт, индекс, морозостойкость)"
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setTab("text")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded ${
                    tab === "text"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Текст · {filteredEntries.length}
                </button>
                <button
                  onClick={() => setTab("tables")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded ${
                    tab === "tables"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Таблицы · {filteredTables.length}
                </button>
              </div>
            </div>

            {tab === "text" && (
              <div className="bg-white border rounded-lg p-4">
                {data.topSections.map((s) => {
                  const items = filteredEntries.filter((e) => e.num.split(".")[0] === s.num);
                  if (items.length === 0) return null;
                  return (
                    <section key={s.num} id={`sec-${s.num}`} className="mb-6">
                      <h2 className="text-base font-bold text-slate-900 mb-3 flex items-baseline gap-2 sticky top-16 bg-white py-1">
                        <span className="font-mono text-slate-400">{s.num}</span>
                        {s.title}
                      </h2>
                      <div className="space-y-3">
                        {items.map((e, i) => (
                          <div key={i} className="text-xs leading-relaxed">
                            <span className="font-mono font-semibold text-emerald-700 mr-2">
                              {e.num}
                            </span>
                            <span className="text-slate-800">{e.text}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {tab === "tables" && (
              <div className="space-y-3">
                {filteredTables.map((t, ti) => (
                  <div key={ti} className="bg-white border rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-900 mb-2">
                      <span className="font-mono text-emerald-700">Таблица {t.num}</span>
                      {" — "}
                      {t.title}
                      <span className="text-[10px] text-slate-400 font-normal ml-2">
                        стр. {t.page}
                      </span>
                    </div>
                    <div className="overflow-auto border rounded">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50">
                          <tr>
                            {t.header.map((h, hi) => (
                              <th
                                key={hi}
                                className="px-2 py-1.5 text-left text-slate-600 uppercase text-[10px] border-b"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, ri) => (
                            <tr key={ri} className="border-b last:border-b-0 hover:bg-emerald-50/40">
                              {row.map((c, ci) => (
                                <td key={ci} className="px-2 py-1 text-slate-700 align-top">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {filteredTables.length === 0 && (
                  <div className="bg-white border rounded-lg p-6 text-center text-slate-400 text-sm">
                    Таблицы по запросу не найдены
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
