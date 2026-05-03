"use client";

import { useEffect } from "react";
import type { Rate } from "../lib/types";
import { RateSearch } from "./RateSearch";

interface Props {
  open: boolean;
  targetSection: string;
  onClose: () => void;
  onPick: (rate: Rate) => void;
}

export function RateDrawer({ open, targetSection, onClose, onPick }: Props) {
  // Закрытие по Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Шапка */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-900 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold text-white">Поиск расценок</div>
            {targetSection && (
              <div className="text-[10px] text-slate-400 mt-0.5">→ {targetSection}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Поиск */}
        <div className="flex-1 overflow-auto p-3">
          <RateSearch
            onPick={(rate) => {
              onPick(rate);
              // Не закрываем drawer — студент может добавить несколько расценок
            }}
          />
        </div>

        {/* Подвал */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
          >
            Готово (Esc)
          </button>
        </div>
      </div>
    </>
  );
}
