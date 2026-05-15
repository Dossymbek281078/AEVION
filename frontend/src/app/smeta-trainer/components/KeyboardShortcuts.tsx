"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Глобальные клавиатурные шорткаты для сметного тренажёра.
 * Подключается в layout.tsx (как AchievementToast).
 *
 * Поддерживаемые шорткаты:
 *   /         — фокус на любое поле поиска (input, textarea[name~="search"])
 *   ?         — показать справку по шорткатам
 *   g h       — на главную (/smeta-trainer)
 *   g l       — поиск по урокам (/lessons-search)
 *   g g       — глоссарий
 *   g c       — шпаргалка (cheatsheet)
 *   g p       — практика
 *   g d       — dashboard
 *   Esc       — закрыть help
 *
 * Не срабатывает, когда фокус в input/textarea/contenteditable.
 */

interface SequenceState {
  prefix: string;
  ts: number;
}

const SEQ_TIMEOUT = 1500;

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [seq, setSeq] = useState<SequenceState | null>(null);

  useEffect(() => {
    function isInputFocused(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }

    function focusFirstSearchInput(): boolean {
      const candidates = document.querySelectorAll<HTMLInputElement>(
        "input[type='text'][placeholder*='Поиск' i],input[type='text'][placeholder*='ищ' i],input[type='text'][placeholder*='search' i]",
      );
      const el = candidates[0];
      if (el) {
        el.focus();
        el.select();
        return true;
      }
      return false;
    }

    function onKey(e: KeyboardEvent) {
      // ESC закрывает help независимо от фокуса
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (isInputFocused()) return;

      // /  → фокус в search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        if (focusFirstSearchInput()) {
          e.preventDefault();
        }
        return;
      }
      // ? → help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      // g + следующая клавиша = переход
      const now = Date.now();
      if (seq && now - seq.ts > SEQ_TIMEOUT) {
        setSeq(null);
      }
      if (e.key === "g" && !seq) {
        setSeq({ prefix: "g", ts: now });
        return;
      }
      if (seq?.prefix === "g") {
        const map: Record<string, string> = {
          h: "/smeta-trainer",
          l: "/smeta-trainer/lessons-search",
          g: "/smeta-trainer/glossary",
          c: "/smeta-trainer/cheatsheet",
          p: "/smeta-trainer/practice",
          d: "/smeta-trainer/dashboard",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          setSeq(null);
          router.push(target);
          return;
        }
        setSeq(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, seq, router]);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Клавиатурные шорткаты"
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 print:hidden"
      onClick={() => setHelpOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            ⌨️ Клавиатурные шорткаты
          </h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-sm"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {[
              ["/", "Фокус в поле поиска"],
              ["?", "Эта справка"],
              ["g h", "Главная курса"],
              ["g l", "Поиск по урокам"],
              ["g g", "Глоссарий"],
              ["g c", "Шпаргалка"],
              ["g p", "Практика"],
              ["g d", "Dashboard"],
              ["Esc", "Закрыть"],
            ].map(([key, desc]) => (
              <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-4">
                  <kbd className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-300 dark:border-slate-600">
                    {key}
                  </kbd>
                </td>
                <td className="py-1.5 text-slate-700 dark:text-slate-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-[10px] text-slate-400 italic">
          Шорткаты не срабатывают, пока фокус в поле ввода. Нажми Esc для закрытия.
        </div>
      </div>
    </div>
  );
}
