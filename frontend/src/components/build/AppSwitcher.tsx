"use client";

import { useRef, useState, useEffect } from "react";

const APPS = [
  { key: "qbuild",    label: "QBuild",          icon: "🏗️",  href: "/build",             desc: "Стройка и найм" },
  { key: "qright",    label: "QRight",           icon: "📜",  href: "/qright",            desc: "IP-права" },
  { key: "qsign",     label: "QSign",            icon: "✍️",  href: "/qsign",             desc: "Подписи" },
  { key: "qcoreai",   label: "QCoreAI",          icon: "🤖",  href: "/qcoreai",           desc: "AI-агенты" },
  { key: "qshield",   label: "Quantum Shield",   icon: "🛡️",  href: "/quantum-shield",    desc: "Безопасность" },
  { key: "qtrade",    label: "QTrade",           icon: "📈",  href: "/qtrade",            desc: "Торговля" },
  { key: "planet",    label: "Planet",           icon: "🌍",  href: "/planet-compliance", desc: "Комплаенс" },
  { key: "bureau",    label: "IP Bureau",        icon: "🏛️",  href: "/bureau",            desc: "Патентное бюро" },
];

export function AppSwitcher() {
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Открыть другое приложение"
        className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition"
        aria-label="App switcher"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="4" height="4" rx="1"/>
          <rect x="6" y="1" width="4" height="4" rx="1"/>
          <rect x="11" y="1" width="4" height="4" rx="1"/>
          <rect x="1" y="6" width="4" height="4" rx="1"/>
          <rect x="6" y="6" width="4" height="4" rx="1"/>
          <rect x="11" y="6" width="4" height="4" rx="1"/>
          <rect x="1" y="11" width="4" height="4" rx="1"/>
          <rect x="6" y="11" width="4" height="4" rx="1"/>
          <rect x="11" y="11" width="4" height="4" rx="1"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="border-b border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            AEVION Apps
          </div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {APPS.map((app) => (
              <button
                key={app.key}
                onClick={() => {
                  window.open(app.href, "_blank", "noopener,noreferrer");
                  setOpen(false);
                }}
                className="flex items-start gap-2 rounded-lg p-2.5 text-left hover:bg-white/5 transition"
              >
                <span className="mt-0.5 text-lg leading-none">{app.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">{app.label}</div>
                  <div className="text-[10px] text-slate-500">{app.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-white/10 px-4 py-2">
            <button
              onClick={() => { window.open("/", "_blank", "noopener,noreferrer"); setOpen(false); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              ← Главная AEVION
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
