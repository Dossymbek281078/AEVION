"use client";

import React, { useRef, useState, useEffect } from "react";
import { useI18n, LANG_FULL, LANG_FLAG, LANG_SHORT, type Lang } from "@/lib/i18n";
import { coveragePercent, langsByCoverage } from "@/lib/langCoverage";

interface Props {
  /** compact — только флаг + код (для header); full — флаг + полное название (для dropdown внутри) */
  variant?: "compact" | "full";
}

export default function LanguageSwitcher({ variant = "compact" }: Props) {
  const { lang, setLang, t } = useI18n();
  const { usable, partial } = langsByCoverage();
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
    // translate="no" на ВЕСЬ переключатель. Название языка — последнее, что
    // можно переводить: человек ищет глазами «Русский» или «RU», а не их
    // перевод. Живой перевод именно это и делал, замерено на проде 10.08.2026:
    // «RU» превратилось в «Роял Юнион» (то есть машина развернула аббревиатуру
    // как Royal Union), и кнопка раздулась с ~40 до 157 точек — на телефоне
    // это почти половина доступной ширины.
    //
    // Тот же класс, что «API» -> «Интерфейс прикладного программирования»
    // в шапке. Аббревиатуры и имена собственные переводу не подлежат.
    <div ref={ref} translate="no" style={{ position: "relative", display: "inline-flex" }}>
      {/* Trigger кнопка */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("langSwitch.pick")}
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
        {/* Флага в самой кнопке нет намеренно.
         *
         * Windows не рисует эмодзи-флаги: региональные индикаторы там
         * показываются двумя буквами кода страны. Рядом с LANG_SHORT это давало
         * «RU RU ▼» — увидено глазами на посадочной /cyberchess/launch 18.08,
         * ни один сторож такого не ловит. На macOS флаг рисуется, и там пара
         * выглядела нормально, поэтому дефект и жил.
         *
         * В выпадающем списке флаг остаётся: там он стоит рядом с «Русский», а
         * не рядом с «RU», и на Windows читается как приставка кода, а не как
         * дубль. */}
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
          {[...usable, ...partial].map((l: Lang) => {
            const active = lang === l;
            const partialShare = partial.includes(l) ? coveragePercent(l) : null;
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
                {/* Choosing a language should not be a guess. These eight have
                    almost no dictionary of their own — measured 28.07.2026 at
                    about 1% — and are filled in by machine translation as the
                    page runs. That is worth knowing before the click, and it is
                    a different promise from a language we translated ourselves.
                    Checked on prod the same day: switching to German does
                    produce German, so "not translated" would be the wrong
                    label; "machine" is the true one. */}
                {partialShare !== null && (
                  <span
                    style={{ fontSize: 11, color: "#8a8886", flexShrink: 0 }}
                    title={t("langSwitch.partial", { share: String(partialShare) })}
                  >
                    машинный
                  </span>
                )}
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
            {usable.length} из {usable.length + partial.length} переведены полностью · остальные — машинный перевод
          </div>
        </div>
      )}
    </div>
  );
}
