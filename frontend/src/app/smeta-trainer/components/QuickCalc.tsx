"use client";

import { useState, useId } from "react";

export function QuickCalc() {
  const [visible, setVisible] = useState(false);
  const [volume, setVolume] = useState("");
  const [rate, setRate] = useState("");
  const [index, setIndex] = useState(1.0);

  const vol = parseFloat(volume) || 0;
  const rt = parseFloat(rate) || 0;
  const total = vol * rt * index;

  const uid = useId();

  const fmt = (n: number) =>
    n === 0
      ? "—"
      : new Intl.NumberFormat("ru-KZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " ₸";

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setVisible((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg font-semibold text-sm transition-all ${
          visible
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-white border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
        }`}
        title="Быстрый расчёт"
        aria-expanded={visible}
        aria-controls="quick-calc-panel"
      >
        🧮 <span>Быстрый расчёт</span>
      </button>

      {/* Panel */}
      {visible && (
        <div
          id="quick-calc-panel"
          className="fixed bottom-20 right-6 z-40 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-2xl p-4"
          role="region"
          aria-label="Быстрый расчёт"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              🧮 Быстрый расчёт
            </span>
            <button
              onClick={() => setVisible(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Объём */}
            <div>
              <label
                htmlFor={`${uid}-vol`}
                className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1"
              >
                Объём работ
              </label>
              <input
                id={`${uid}-vol`}
                type="number"
                min="0"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 dark:bg-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300"
              />
            </div>

            {/* Расценка */}
            <div>
              <label
                htmlFor={`${uid}-rate`}
                className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1"
              >
                Расценка (₸ / ед.)
              </label>
              <input
                id={`${uid}-rate`}
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 dark:bg-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300"
              />
            </div>

            {/* Индекс */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor={`${uid}-idx`}
                  className="text-[11px] text-slate-500 dark:text-slate-400 font-medium"
                >
                  Индекс перевода в тек. цены
                </label>
                <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  ×{index.toFixed(2)}
                </span>
              </div>
              <input
                id={`${uid}-idx`}
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={index}
                onChange={(e) => setIndex(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.50</span>
                <span>1.00</span>
                <span>2.00</span>
                <span>3.00</span>
              </div>
            </div>

            {/* Формула и итог */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 mt-1">
              <div className="text-[10px] text-slate-400 font-mono mb-1 text-center">
                {vol || 0} × {rt || 0} × {index.toFixed(2)} =
              </div>
              <div
                className={`text-center text-xl font-bold transition-colors ${
                  total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                }`}
              >
                {fmt(total)}
              </div>
              {total > 0 && (
                <div className="text-[10px] text-slate-400 text-center mt-1">
                  без НР, СП, НДС
                </div>
              )}
            </div>

            {/* Сброс */}
            <button
              onClick={() => { setVolume(""); setRate(""); setIndex(1.0); }}
              className="w-full text-[11px] text-slate-400 hover:text-red-500 py-1 transition-colors"
            >
              Очистить
            </button>
          </div>
        </div>
      )}
    </>
  );
}
