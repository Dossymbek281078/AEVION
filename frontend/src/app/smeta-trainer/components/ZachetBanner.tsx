"use client";

import Link from "next/link";

interface ZachetBannerProps {
  visible: boolean;
  level: number;
  passed?: boolean;
  score?: number;
  message?: string;
}

export function ZachetBanner({ visible, level, passed = true, score, message }: ZachetBannerProps) {
  if (!visible) return null;

  const nextLevel = level < 5 ? level + 1 : null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 w-full max-w-lg pointer-events-none">
      <div
        className={`rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-4 pointer-events-auto border-2 ${
          passed
            ? "bg-emerald-600 border-emerald-500 text-white"
            : "bg-red-600 border-red-500 text-white"
        }`}
      >
        <div className="text-2xl shrink-0 mt-0.5">{passed ? "🎓" : "📝"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {passed ? `Уровень ${level} зачтён!` : `Уровень ${level} — нужна пересдача`}
          </div>
          <div className={`text-xs mt-0.5 ${passed ? "text-emerald-100" : "text-red-100"}`}>
            {message ?? (passed
              ? `Результат сохранён.${score !== undefined ? ` Балл: ${score}/100.` : ""}`
              : "Попробуйте ещё раз — результат сохранён.")}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
            {passed && nextLevel && (
              <Link
                href={`/smeta-trainer/level/${nextLevel}`}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold"
              >
                Уровень {nextLevel} →
              </Link>
            )}
            {passed && !nextLevel && (
              <Link
                href="/smeta-trainer/certificate"
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold"
              >
                📜 Сертификат →
              </Link>
            )}
            <Link
              href="/smeta-trainer"
              className="text-white/70 hover:text-white underline"
            >
              К курсу
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
