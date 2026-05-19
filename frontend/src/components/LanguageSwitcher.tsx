"use client";

import React, { useRef, useState, useEffect } from "react";
import { useI18n, LANGS, LANG_FULL, LANG_FLAG, LANG_SHORT, type Lang } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Выбрать язык / Select language"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 9px",
          borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.15)",
          background: open ? "rgba(15,23,42,0.06)" : "transparent",
          color: "#334155",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: "background 150ms",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "rgba(15,23,42,0.06)" : "transparent")}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{LANG_FLAG[lang]}</span>
        <span>{LANG_SHORT[lang]}</span>
        <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 1 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Язык интерфейса"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 9999,
            minWidth: 180,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            overflow: "hidden",
            padding: "4px 0",
          }}
        >
          {LANGS.map((l: Lang) => {
            const active = lang === l;
            return (
              <button
                key={l}
                role="option"
                aria-selected={active}
                onClick={() => { setLang(l); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 14px",
                  border: "none",
                  background: active ? "rgba(13,148,136,0.08)" : "transparent",
                  color: active ? "#0d9488" : "#334155",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 800 : 500,
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(13,148,136,0.08)" : "transparent"; }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{LANG_FLAG[l]}</span>
                <span style={{ flex: 1 }}>{LANG_FULL[l]}</span>
                {active && <span style={{ fontSize: 12, color: "#0d9488" }}>✓</span>}
              </button>
            );
          })}
          <div style={{
            borderTop: "1px solid #f1f5f9",
            padding: "6px 14px",
            fontSize: 10,
            color: "#94a3b8",
            textAlign: "center",
          }}>
            11 языков
          </div>
        </div>
      )}
    </div>
  );
}
