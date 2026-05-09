"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LESSONS, type Lesson } from "../lib/lessons";

interface Match {
  lesson: Lesson;
  /** Сниппеты с ±60 символов вокруг каждого совпадения. */
  snippets: string[];
  /** Совпадает ли заголовок. */
  titleMatch: boolean;
  /** Кол-во найденных вхождений (для сортировки). */
  hitCount: number;
}

const SNIPPET_PAD = 60;
const MAX_SNIPPETS_PER_LESSON = 3;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(query: string): Match[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const re = new RegExp(escapeRegExp(q), "gi");
  const results: Match[] = [];
  for (const lesson of LESSONS) {
    const titleMatch = lesson.title.toLowerCase().includes(q);
    const snippets: string[] = [];
    let hitCount = 0;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lesson.content)) !== null && snippets.length < MAX_SNIPPETS_PER_LESSON) {
      hitCount++;
      const start = Math.max(0, m.index - SNIPPET_PAD);
      const end = Math.min(lesson.content.length, m.index + m[0].length + SNIPPET_PAD);
      const before = (start > 0 ? "…" : "") + lesson.content.slice(start, m.index);
      const hit = lesson.content.slice(m.index, m.index + m[0].length);
      const after = lesson.content.slice(m.index + m[0].length, end) + (end < lesson.content.length ? "…" : "");
      snippets.push(JSON.stringify({ before, hit, after }));
    }
    // Дальнейшие совпадения только для счётчика
    while ((m = re.exec(lesson.content)) !== null) hitCount++;
    if (titleMatch || snippets.length > 0) {
      results.push({ lesson, snippets, titleMatch, hitCount });
    }
  }
  return results.sort((a, b) =>
    (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0) || b.hitCount - a.hitCount,
  );
}

export default function LessonsSearchPage() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => findMatches(query), [query]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Поиск по теории курса</h1>
            <p className="text-[11px] text-slate-500">
              {LESSONS.length} уроков · ищем по заголовку и тексту
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
        {/* Поле поиска */}
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите запрос: «накладные», «КС-2», «дефектная ведомость», «зимнее»..."
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {query && (
            <div className="text-[11px] text-slate-500 mt-2">
              Найдено уроков: <strong>{matches.length}</strong>
              {matches.length > 0 && (
                <span> · совпадений всего: <strong>{matches.reduce((s, m) => s + m.hitCount, 0)}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* Результаты */}
        {!query && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            Начните вводить запрос — поиск идёт сразу. Для перехода к уроку — клик
            по карточке (откроется уровень и нужный урок).
          </div>
        )}
        {query && matches.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            По запросу «{query}» ничего не найдено в 32 уроках. Попробуйте более общий термин.
          </div>
        )}

        <div className="space-y-2">
          {matches.map(({ lesson, snippets, titleMatch, hitCount }) => (
            <Link
              key={lesson.id}
              href={`/smeta-trainer/level/${lesson.level}#lesson-${encodeURIComponent(lesson.id)}`}
              className="block bg-white border border-slate-200 hover:border-emerald-400 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Уровень {lesson.level}
                </span>
                <h2
                  className="text-sm font-bold text-slate-900 flex-1"
                  dangerouslySetInnerHTML={{
                    __html: titleMatch ? highlight(lesson.title, query) : lesson.title,
                  }}
                />
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  ~{lesson.durationMin} мин · совпадений: {hitCount}
                </span>
              </div>
              {snippets.length > 0 && (
                <div className="mt-2 space-y-1">
                  {snippets.map((s, i) => {
                    const { before, hit, after } = JSON.parse(s) as { before: string; hit: string; after: string };
                    return (
                      <div key={i} className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1 leading-snug">
                        <span>{before}</span>
                        <mark className="bg-amber-200 text-slate-900 font-semibold px-0.5">{hit}</mark>
                        <span>{after}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function highlight(text: string, query: string): string {
  if (!query.trim()) return text;
  const re = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return text.replace(
    re,
    '<mark class="bg-amber-200 text-slate-900 font-semibold px-0.5">$1</mark>',
  );
}
