"use client";

import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  computeEarned,
  loadSeenAchievements,
  saveSeenAchievements,
  type Achievement,
} from "../lib/achievements";
import { loadLessonProgress } from "../lib/lessons";

const PROGRESS_KEY = "aevion-smeta-progress-v1";

interface QueuedToast {
  achievement: Achievement;
  uid: number;
}

/**
 * Глобальный тост о новых достижениях. Слушает событие aevion-smeta-progress-update
 * (диспатчится из saveLessonProgress и useProgress.setLevel), пересчитывает
 * полученные достижения, сравнивает с сохранённым множеством "увиденных" и
 * показывает тост для каждого нового. Стек тостов автоматически исчезает
 * через 6 секунд каждый.
 */
export function AchievementToast() {
  const [queue, setQueue] = useState<QueuedToast[]>([]);

  useEffect(() => {
    function readProgress(): {
      progress: Parameters<typeof computeEarned>[0];
      lessons: Parameters<typeof computeEarned>[1];
    } {
      let progress = { levels: {} } as Parameters<typeof computeEarned>[0];
      try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (raw) progress = JSON.parse(raw);
      } catch {}
      const lessons = loadLessonProgress();
      return { progress, lessons };
    }

    function check() {
      const { progress, lessons } = readProgress();
      const earned = computeEarned(progress, lessons);
      const seen = loadSeenAchievements();
      const newOnes: Achievement[] = [];
      earned.forEach((id) => {
        if (!seen.has(id)) {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          if (a) newOnes.push(a);
          seen.add(id);
        }
      });
      if (newOnes.length > 0) {
        saveSeenAchievements(seen);
        setQueue((prev) => [
          ...prev,
          ...newOnes.map((a) => ({ achievement: a, uid: Date.now() + Math.random() })),
        ]);
      }
    }

    // Первичная сверка — на случай, если уровень/урок были закрыты в сессии,
    // которая ещё не показывала тостов (или это первый визит после раскатки фичи)
    check();

    function onUpdate() { check(); }
    window.addEventListener("aevion-smeta-progress-update", onUpdate);
    return () => window.removeEventListener("aevion-smeta-progress-update", onUpdate);
  }, []);

  // Авто-удаление тоста через 6 сек
  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, 6000);
    return () => clearTimeout(t);
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-xs print:hidden">
      {queue.map((q) => (
        <div
          key={q.uid}
          className="bg-white border-2 border-emerald-400 rounded-xl shadow-2xl p-3 flex gap-3 items-start animate-in-toast"
          role="status"
        >
          <div className="text-3xl shrink-0">{q.achievement.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
              ✨ Новое достижение
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {q.achievement.title}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              {q.achievement.description}
            </div>
          </div>
          <button
            onClick={() => setQueue((prev) => prev.filter((x) => x.uid !== q.uid))}
            className="text-slate-300 hover:text-slate-700 text-xs shrink-0"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideInToast {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .animate-in-toast {
          animation: slideInToast 0.35s ease-out;
        }
      `}</style>
    </div>
  );
}
