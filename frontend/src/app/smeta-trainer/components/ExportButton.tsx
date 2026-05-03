"use client";

import { useRef, useState } from "react";
import type { Lsr, LsrCalc } from "../lib/types";
import { exportToCsv, exportToJson, importFromJson } from "../lib/exportLsr";

interface Props {
  lsr: Lsr;
  calc: LsrCalc;
  onImport: (lsr: Lsr) => void;
}

export function ExportButton({ lsr, calc, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:border-emerald-400 hover:text-emerald-700 transition-colors"
      >
        <span>⬇</span> Экспорт
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl w-52 py-1.5 overflow-hidden">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">Скачать</div>

            <button
              onClick={() => { exportToCsv(lsr, calc); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
            >
              <span className="text-lg">📊</span>
              <div>
                <div className="font-medium text-slate-800">Excel (CSV)</div>
                <div className="text-[10px] text-slate-400">Открывается в Excel</div>
              </div>
            </button>

            <button
              onClick={() => { window.print(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
            >
              <span className="text-lg">📄</span>
              <div>
                <div className="font-medium text-slate-800">PDF (Печать)</div>
                <div className="text-[10px] text-slate-400">Через диалог браузера</div>
              </div>
            </button>

            <button
              onClick={() => { exportToJson(lsr); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
            >
              <span className="text-lg">💾</span>
              <div>
                <div className="font-medium text-slate-800">JSON (резервная копия)</div>
                <div className="text-[10px] text-slate-400">Восстановить позже</div>
              </div>
            </button>

            <div className="border-t border-slate-100 mt-1 pt-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">Загрузить</div>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="text-lg">📂</span>
                <div>
                  <div className="font-medium text-slate-800">Открыть JSON</div>
                  <div className="text-[10px] text-slate-400">Восстановить смету</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { importFromJson(file, onImport); setOpen(false); }
          e.target.value = "";
        }}
      />
    </div>
  );
}
