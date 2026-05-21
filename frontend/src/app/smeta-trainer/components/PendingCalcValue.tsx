"use client";

/**
 * Toast that picks up values transferred from companion tools (/calc, /rates)
 * via localStorage and offers to apply them to the LSR on /exam/[id].
 *
 *   value-transfer (from /calc):
 *     key:   smeta-trainer:pending-calc-value
 *     shape: { kind?: "value"; value: number; label: string; unit: string; at: number }
 *     apply: write `value` into the last position of the first section
 *
 *   rate-transfer (from /rates):
 *     key:   smeta-trainer:pending-rate-code
 *     shape: { kind: "rate"; rateCode: string; title: string; unit: string; at: number }
 *     apply: append a fresh position with that rateCode to the first section
 */

import { useEffect, useState } from "react";

const VALUE_KEY = "smeta-trainer:pending-calc-value";
const RATE_KEY = "smeta-trainer:pending-rate-code";

type ValuePending = {
  kind?: "value";
  value: number;
  label: string;
  unit: string;
  at: number;
};

type RatePending = {
  kind: "rate";
  rateCode: string;
  title: string;
  unit: string;
  at: number;
};

type Pending =
  | ({ source: "value" } & ValuePending)
  | ({ source: "rate" } & RatePending);

function readPending(): Pending | null {
  if (typeof window === "undefined") return null;
  const rawRate = window.localStorage.getItem(RATE_KEY);
  if (rawRate) {
    try {
      const parsed = JSON.parse(rawRate) as RatePending;
      if (typeof parsed.rateCode === "string" && parsed.rateCode.length > 0) {
        return { source: "rate", ...parsed, kind: "rate" };
      }
    } catch {
      /* fall through */
    }
  }
  const rawValue = window.localStorage.getItem(VALUE_KEY);
  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as ValuePending;
      if (typeof parsed.value === "number" && isFinite(parsed.value)) {
        return { source: "value", ...parsed };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

function clearPending(source: "value" | "rate") {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(source === "rate" ? RATE_KEY : VALUE_KEY);
}

export function PendingCalcValue({
  onApplyValue,
  onApplyRate,
}: {
  onApplyValue: (value: number) => void;
  onApplyRate?: (rateCode: string) => void;
}) {
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

  const isRate = pending.source === "rate";
  const headline = isRate
    ? "Из каталога расценок"
    : "Из калькулятора";
  const primary = isRate
    ? `${pending.rateCode}`
    : `${pending.value.toFixed(2)}`;
  const secondary = isRate
    ? pending.title
    : pending.label;
  const actionLabel = isRate ? "Добавить позицию" : "Применить объём";

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-emerald-400 rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 max-w-xl print:hidden">
      <span className="text-2xl">{isRate ? "📋" : "✨"}</span>
      <div className="flex-1 text-xs">
        <div className="font-bold text-slate-800">
          {headline}:{" "}
          <span className="font-mono text-emerald-700">{primary}</span>{" "}
          <span className="text-slate-500">{pending.unit}</span>
        </div>
        <div className="text-[10px] text-slate-500 truncate max-w-md">
          {secondary}
          {ageMin > 0 && ` · ${ageMin} мин назад`}
        </div>
      </div>
      <button
        onClick={() => {
          if (pending.source === "rate") {
            if (onApplyRate) onApplyRate(pending.rateCode);
            clearPending("rate");
          } else {
            onApplyValue(pending.value);
            clearPending("value");
          }
          setPending(readPending());
        }}
        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
        title={
          isRate
            ? "Добавит новую позицию в первый раздел"
            : "Подставит в последнюю позицию первого раздела"
        }
      >
        {actionLabel}
      </button>
      <button
        onClick={() => {
          clearPending(pending.source);
          setPending(readPending());
        }}
        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
        title="Отклонить"
      >
        ✕
      </button>
    </div>
  );
}
