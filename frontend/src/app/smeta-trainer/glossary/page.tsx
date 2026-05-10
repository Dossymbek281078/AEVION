"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  GLOSSARY,
  searchGlossary,
  type GlossaryCategory,
  type GlossaryEntry,
} from "../lib/glossary";
import { findLesson } from "../lib/lessons";

export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<GlossaryCategory | "all">("all");

  const filtered = useMemo<GlossaryEntry[]>(() => {
    let list = searchGlossary(query);
    if (activeCat !== "all") list = list.filter((e) => e.category === activeCat);
    return list.slice().sort((a, b) =>
      a.term.localeCompare(b.term, "ru", { sensitivity: "base" })
    );
  }, [query, activeCat]);

  // Подсчёт по категориям (для бейджей в фильтре, без учёта поиска)
  const catCounts = useMemo(() => {
    const map: Record<string, number> = { all: GLOSSARY.length };
    GLOSSARY.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + 1;
    });
    return map;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Глоссарий сметных терминов РК</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {GLOSSARY.length} терминов · нормативная база НДЦС РК 8.01-08-2022, СН РК 8.02
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-4 space-y-4">
        {/* Поиск */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск термина (например: индекс, НР, КС-2, дефектная)..."
              className="w-full border border-slate-300 rounded-lg px-4 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Категории */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCat("all")}
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                activeCat === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Все ({catCounts.all})
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  activeCat === c.id
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c.icon} {c.label} ({catCounts[c.id] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Результаты */}
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            По запросу «{query}» ничего не найдено. Попробуйте изменить фильтр или сократите запрос.
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((e) => {
            const cat = CATEGORIES.find((c) => c.id === e.category);
            const refs = (e.lessonRefs ?? [])
              .map((id) => ({ id, lesson: findLesson(id) }))
              .filter((x): x is { id: string; lesson: NonNullable<ReturnType<typeof findLesson>> } => x.lesson !== null);
            return (
              <div
                key={e.term}
                id={`term-${e.term}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors"
              >
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">{e.term}</h2>
                  {e.term !== e.full && (
                    <span className="text-sm text-slate-600">— {e.full}</span>
                  )}
                  {cat && (
                    <span className="ml-auto text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                      {cat.icon} {cat.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed mt-2">{e.definition}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {e.normRef && (
                    <span className="text-slate-500">
                      <span className="text-slate-400">📖</span> {e.normRef}
                    </span>
                  )}
                  {refs.length > 0 && (
                    <span className="text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400">📚 разбирается в уроках:</span>
                      {refs.map(({ id, lesson }) => (
                        <Link
                          key={id}
                          href={`/smeta-trainer/level/${lesson.level}`}
                          className="text-emerald-700 hover:text-emerald-900 underline"
                          title={lesson.title}
                        >
                          Ур.{lesson.level} · {lesson.title.length > 40 ? lesson.title.slice(0, 40) + "…" : lesson.title}
                        </Link>
                      ))}
                    </span>
                  )}
                  {e.aliases && e.aliases.length > 0 && (
                    <span className="text-slate-400 italic">
                      также: {e.aliases.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-400 text-center pt-4 italic">
          Источники: НДЦС РК 8.01-08-2022 · СН РК 8.02-07-2014 · СН РК 8.02-09-2018 · ССЦ РК 8.04-08-2025 · СНиП РК 1.02-18-2004
        </div>
      </div>
    </div>
  );
}
