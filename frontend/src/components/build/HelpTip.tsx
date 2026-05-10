"use client";

import { useEffect, useRef, useState } from "react";

export function HelpTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-grid h-4 w-4 place-items-center rounded-full border border-slate-600 bg-slate-800 text-[10px] font-bold text-slate-400 hover:border-emerald-500/60 hover:text-emerald-300 transition"
        aria-label="Подсказка"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-64 rounded-lg border border-white/10 bg-slate-800 p-3 text-xs text-slate-300 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}
