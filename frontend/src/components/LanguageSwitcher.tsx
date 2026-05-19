"use client";

import React, { useRef, useState, useEffect } from "react";
import { useI18n, LANGS, LANG_FULL, LANG_FLAG, LANG_SHORT, type Lang } from "@/lib/i18n";

interface Props {
  /** compact — только флаг + код (для header); full — флаг + полное название (для dropdown внутри) */
  variant?: "compact" | "full";
}

export default function LanguageSwitcher({ variant = "compact" }: Props) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрыть при клике вне
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Закрыть по Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {/* Trigger кнопка */}
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
          border: "1px solid rgba(255,255,255,0.15)",
          background: open ? "rgba(255,255,255,0.12)" : "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: "background 150ms",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "rgba(255,255,255,0.12)" : "transparent")}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{LANG_FLAG[lang]}</span>
        <span>{LANG_SHORT[lang]}</span>
        <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Язык интерфейса"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 9999,
            minWidth: 190,
            background: "#1e1c19",
            border: "1px solid #3d3b39",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
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
                  background: active ? "rgba(117,153,0,0.15)" : "transparent",
                  color: active ? "#98b800" : "#bababa",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 800 : 500,
                  textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={e => {
                  if (!active)(e.currentTarget.style.background = "rgba(255,255,255,0.06)");
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = active ? "rgba(117,153,0,0.15)" : "transparent";
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{LANG_FLAG[l]}</span>
                <span style={{ flex: 1 }}>{LANG_FULL[l]}</span>
                {active && <span style={{ fontSize: 12, color: "#98b800" }}>✓</span>}
              </button>
            );
          })}

          {/* Подсказка внизу */}
          <div style={{
            borderTop: "1px solid #3d3b39",
            padding: "6px 14px",
            fontSize: 10,
            color: "#5d5b59",
            textAlign: "center",
          }}>
            11 языков · добавляем переводы
          </div>
        </div>
      )}
    </div>
  );
}
