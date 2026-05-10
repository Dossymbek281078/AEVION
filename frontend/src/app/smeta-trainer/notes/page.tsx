"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LESSONS, findLesson } from "../lib/lessons";
import { loadAllNotes } from "../lib/useLessonNotes";

function buildMarkdown(notes: Record<string, string>): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Конспект курса «Сметное дело в РК»`);
  lines.push(``);
  lines.push(`> Экспортировано из AEVION Сметного тренажёра, ${today}`);
  lines.push(``);

  // Группируем по уровню и сохраняем порядок уроков
  for (let lvl = 1; lvl <= 5; lvl++) {
    const lessonsHere = LESSONS.filter((l) => l.level === lvl && notes[l.id]?.trim());
    if (lessonsHere.length === 0) continue;
    lines.push(`## Уровень ${lvl}`);
    lines.push(``);
    for (const lesson of lessonsHere) {
      lines.push(`### ${lesson.title}`);
      lines.push(``);
      lines.push(notes[lesson.id].trim());
      lines.push(``);
    }
  }
  return lines.join("\n");
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(loadAllNotes());
    setHydrated(true);
  }, []);

  const md = useMemo(() => buildMarkdown(notes), [notes]);
  const entries = useMemo(
    () => Object.entries(notes).filter(([, v]) => v.trim()),
    [notes],
  );
  const totalChars = entries.reduce((s, [, v]) => s + v.length, 0);

  function handleCopy() {
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aevion-smeta-конспект-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClearAll() {
    if (!confirm("Удалить все заметки? Это действие необратимо.")) return;
    localStorage.removeItem("aevion-smeta-lesson-notes-v1");
    setNotes({});
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Мои заметки</h1>
            <p className="text-[11px] text-slate-500">
              Конспекты, которые вы оставляли в уроках. Хранятся локально в браузере.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-600">{entries.length}</div>
            <div className="text-[10px] text-slate-400">{totalChars.toLocaleString("ru-RU")} символов</div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
        {entries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm text-slate-700 font-semibold">Заметок пока нет</div>
            <div className="text-xs text-slate-500 mt-1">
              Откройте любой урок теории — внизу будет блок «📝 Мои заметки». Всё, что
              вы там запишете, появится здесь.
            </div>
            <Link
              href="/smeta-trainer/level/1"
              className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
            >
              К Уровню 1
            </Link>
          </div>
        ) : (
          <>
            {/* Кнопки экспорта */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
              >
                {copied ? "✓ Скопировано" : "📋 Копировать всё (Markdown)"}
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded hover:bg-slate-900"
              >
                ⬇ Скачать .md
              </button>
              <span className="text-[10px] text-slate-400 ml-auto">
                Markdown сохраняет иерархию: Уровень → Урок → Текст
              </span>
              <button
                onClick={handleClearAll}
                className="text-[10px] text-red-500 hover:text-red-700 underline ml-2"
              >
                Удалить все
              </button>
            </div>

            {/* Карточки уроков */}
            <div className="space-y-2">
              {entries
                .map(([id, text]) => ({ id, text, lesson: findLesson(id) }))
                .filter((e): e is { id: string; text: string; lesson: NonNullable<ReturnType<typeof findLesson>> } => e.lesson !== null)
                .sort((a, b) => a.lesson.level - b.lesson.level || a.lesson.id.localeCompare(b.lesson.id))
                .map(({ id, text, lesson }) => (
                  <div key={id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-baseline gap-2 flex-wrap mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Ур. {lesson.level}
                      </span>
                      <h2 className="text-sm font-bold text-slate-900 flex-1">{lesson.title}</h2>
                      <Link
                        href={`/smeta-trainer/level/${lesson.level}#lesson-${encodeURIComponent(id)}`}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 underline shrink-0"
                      >
                        Открыть урок →
                      </Link>
                    </div>
                    <pre className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 whitespace-pre-wrap font-mono leading-snug">
                      {text}
                    </pre>
                  </div>
                ))}
            </div>

            {/* Превью markdown */}
            <details className="bg-white border border-slate-200 rounded-lg p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                👁 Превью полного Markdown-экспорта
              </summary>
              <pre className="mt-2 text-[10px] text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 whitespace-pre-wrap font-mono leading-snug max-h-96 overflow-auto">
                {md}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
