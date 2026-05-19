"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_LOCALES, useCcI18n, type CcLocale } from "./i18n";

type Props = {
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  brand: string;
};

export default function LocaleSwitcher({ surface1, surface2, border, text, textDim, brand }: Props) {
  const { locale, setLocale } = useCcI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Сменить язык / Change language / Тілді ауыстыру"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 9999,
          border: `1px solid ${open ? brand : border}`,
          background: open ? `${brand}15` : surface1,
          color: text, fontSize: 11, fontWeight: 800, cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span>{current.flag}</span>
        <span style={{ textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{current.code}</span>
        <span style={{ fontSize: 9, color: textDim }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            minWidth: 180, zIndex: 250,
            background: surface1, border: `1px solid ${border}`, borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            padding: 6,
          }}
        >
          {SUPPORTED_LOCALES.map(l => {
            const active = l.code === locale;
            return (
              <button key={l.code}
                onClick={() => { setLocale(l.code as CcLocale); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "7px 10px",
                  border: "none", background: active ? `${brand}18` : "transparent",
                  color: active ? brand : text,
                  borderRadius: 6, cursor: "pointer", textAlign: "left" as const,
                  fontSize: 12, fontWeight: active ? 800 : 600,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = surface2; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16 }}>{l.flag}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                {active && <span style={{ color: brand, fontSize: 11 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
