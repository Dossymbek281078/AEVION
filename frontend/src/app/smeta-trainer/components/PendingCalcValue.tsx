"use client";

/**
 * Listens for a value sent from /calc via localStorage
 * (key `smeta-trainer:pending-calc-value`) and offers to apply it
 * to the last position of the first section of the LSR.
 * The student can also dismiss the toast — value stays in clipboard.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "smeta-trainer:pending-calc-value";

type Pending = {
  value: number;
  label: string;
  unit: string;
  at: number;
};

function readPending(): Pending | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Pending;
    if (typeof parsed.value !== "number" || !isFinite(parsed.value)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPending() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function PendingCalcValue({ onApply }: { onApply: (value: number) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setPending(readPending());
    function refresh() {
      setPending(readPending());
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!pending) return null;

  const ageMin = Math.round((Date.now() - pending.at) / 60_000);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-emerald-400 rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 max-w-xl print:hidden">
      <span className="text-2xl">✨</span>
      <div className="flex-1 text-xs">
        <div className="font-bold text-slate-800">
          Из калькулятора: <span className="font-mono text-emerald-700">{pending.value.toFixed(2)}</span>{" "}
          <span className="text-slate-500">{pending.unit}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          {pending.label}
          {ageMin > 0 && ` · ${ageMin} мин назад`}
        </div>
      </div>
      <button
        onClick={() => {
          onApply(pending.value);
          clearPending();
          setPending(null);
        }}
        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
        title="Подставить в последнюю позицию первого раздела"
      >
        Применить
      </button>
      <button
        onClick={() => {
          clearPending();
          setPending(null);
        }}
        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
        title="Отклонить"
      >
        ✕
      </button>
    </div>
  );
}
