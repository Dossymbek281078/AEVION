"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { COLOR, RADIUS, SHADOW, MOTION, SPACE, Z } from "./theme";

/* ═══════════════════════════════════════════════════════════
   Button
   ═══════════════════════════════════════════════════════════ */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "accent";
type BtnSize = "xs" | "sm" | "md" | "lg";

export type BtnProps = {
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  title?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const BTN_SIZE: Record<BtnSize, { pad: string; fs: number; gap: number; h: number }> = {
  xs: { pad: "4px 8px",  fs: 12, gap: 4, h: 26 },
  sm: { pad: "6px 10px", fs: 13, gap: 6, h: 32 },
  md: { pad: "8px 14px", fs: 14, gap: 8, h: 38 },
  lg: { pad: "12px 20px",fs: 15, gap: 10, h: 46 },
};

const variantStyle = (v: BtnVariant, active: boolean): React.CSSProperties => {
  const base: React.CSSProperties = { border: `1px solid transparent` };
  if (v === "primary") return { ...base,
    background: active ? COLOR.brandHover : COLOR.brand,
    color: COLOR.textInv, borderColor: active ? COLOR.brandHover : COLOR.brand,
    boxShadow: active ? "none" : SHADOW.sm };
  if (v === "secondary") return { ...base,
    background: active ? COLOR.surface3 : COLOR.surface1, color: COLOR.text,
    borderColor: COLOR.border };
  if (v === "ghost") return { ...base,
    background: active ? COLOR.surface3 : "transparent", color: COLOR.text,
    borderColor: "transparent" };
  if (v === "danger") return { ...base,
    background: active ? "#b91c1c" : COLOR.danger, color: COLOR.textInv,
    borderColor: COLOR.danger };
  if (v === "gold") return { ...base,
    background: active ? "#b45309" : COLOR.gold, color: COLOR.textInv,
    borderColor: COLOR.gold };
  if (v === "accent") return { ...base,
    background: active ? "#6d28d9" : COLOR.accent, color: COLOR.textInv,
    borderColor: COLOR.accent };
  return base;
};

export function Btn({ variant = "secondary", size = "md", full, loading, disabled,
  icon, iconRight, active, onClick, type = "button", title, ariaLabel, style, children }: BtnProps) {
  const sz = BTN_SIZE[size];
  return (
    <button
      type={type}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
      className="cc-focus-ring cc-touch"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: sz.gap, padding: sz.pad, fontSize: sz.fs, fontWeight: 700,
        borderRadius: RADIUS.md, cursor: disabled || loading ? "not-allowed" : "pointer",
        width: full ? "100%" : undefined, minHeight: sz.h, lineHeight: 1.1,
        opacity: disabled ? 0.5 : 1,
        transition: `background ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.fast} ${MOTION.ease}, box-shadow ${MOTION.fast} ${MOTION.ease}`,
        ...variantStyle(variant, !!active), ...style,
      }}
      onMouseEnter={e => {
        if (disabled || loading) return;
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(-1px)";
        const cur = el.style.boxShadow;
        if (!cur) el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseDown={e => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
      onMouseUp={e => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "";
        // Reset only if we set it (heuristic: variant-secondary with no explicit shadow)
        if (el.style.boxShadow === "0 4px 12px rgba(0,0,0,0.08)") el.style.boxShadow = "";
      }}
    >
      {loading ? <Spinner size={sz.fs} /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Card
   ═══════════════════════════════════════════════════════════ */

export function Card({ children, padding = SPACE[4], radius = RADIUS.lg,
  elevation = "sm", tone = "surface1", style, onClick }:
  { children: React.ReactNode; padding?: number; radius?: number;
    elevation?: "none"|"sm"|"md"|"lg"; tone?: "surface1"|"surface2"|"surface3"|"glass";
    style?: React.CSSProperties; onClick?: () => void; }) {
  const bg = tone === "glass" ? COLOR.surfaceGlass :
             tone === "surface2" ? COLOR.surface2 :
             tone === "surface3" ? COLOR.surface3 : COLOR.surface1;
  const sh = elevation === "none" ? "none" :
             elevation === "lg" ? SHADOW.lg :
             elevation === "md" ? SHADOW.md : SHADOW.sm;
  return (
    <div
      onClick={onClick}
      onMouseEnter={onClick ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = SHADOW.md;
      } : undefined}
      onMouseLeave={onClick ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
        el.style.boxShadow = sh;
      } : undefined}
      style={{
        background: bg, border: `1px solid ${COLOR.border}`,
        borderRadius: radius, padding, boxShadow: sh,
        backdropFilter: tone === "glass" ? "blur(10px)" : undefined,
        WebkitBackdropFilter: tone === "glass" ? "blur(10px)" : undefined,
        cursor: onClick ? "pointer" : undefined,
        transition: `box-shadow ${MOTION.base} ${MOTION.ease}, transform ${MOTION.base} ${MOTION.ease}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Badge
   ═══════════════════════════════════════════════════════════ */

type BadgeTone = "neutral"|"brand"|"accent"|"gold"|"danger"|"info";
export function Badge({ tone = "neutral", size = "sm", children, icon, style }:
  { tone?: BadgeTone; size?: "xs"|"sm"|"md"; children?: React.ReactNode;
    icon?: React.ReactNode; style?: React.CSSProperties }) {
  const pal: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: COLOR.surface3, fg: COLOR.textDim },
    brand:   { bg: COLOR.brandSoft, fg: COLOR.brand },
    accent:  { bg: COLOR.accentSoft, fg: COLOR.accent },
    gold:    { bg: COLOR.goldSoft, fg: COLOR.gold },
    danger:  { bg: COLOR.dangerSoft, fg: COLOR.danger },
    info:    { bg: COLOR.infoSoft, fg: COLOR.info },
  };
  const sz = size === "xs" ? { pad: "2px 6px", fs: 11 } :
             size === "md" ? { pad: "4px 10px", fs: 13 } :
                             { pad: "3px 8px", fs: 12 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
      padding: sz.pad, fontSize: sz.fs, fontWeight: 700, lineHeight: 1,
      borderRadius: RADIUS.full,
      background: pal[tone].bg, color: pal[tone].fg, ...style }}>
      {icon}{children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tabs / Segment
   ═══════════════════════════════════════════════════════════ */

export type TabDef<V extends string> = { value: V; label: React.ReactNode; icon?: React.ReactNode; hint?: string };
export function Tabs<V extends string>({ value, onChange, tabs, variant = "pill", size = "md" }:
  { value: V; onChange: (v: V) => void; tabs: TabDef<V>[];
    variant?: "pill"|"segment"|"underline"; size?: "sm"|"md"|"lg" }) {
  const isSeg = variant === "segment";
  const isUnder = variant === "underline";
  const fs = size === "sm" ? 12 : size === "lg" ? 15 : 13;
  const pad = size === "sm" ? "6px 10px" : size === "lg" ? "10px 18px" : "8px 14px";
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex", gap: isSeg ? 0 : 4,
        background: isSeg ? COLOR.surface3 : "transparent",
        borderRadius: isSeg ? RADIUS.md : 0,
        padding: isSeg ? 3 : 0,
        borderBottom: isUnder ? `1px solid ${COLOR.border}` : undefined,
      }}
    >
      {tabs.map(t => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            title={t.hint}
            className="cc-focus-ring cc-touch"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: pad, fontSize: fs, fontWeight: active ? 800 : 700,
              background: active
                ? (isUnder ? "transparent" : `linear-gradient(135deg, ${COLOR.surface1}, ${COLOR.surface2})`)
                : "transparent",
              color: active ? (isUnder ? COLOR.brand : COLOR.text) : COLOR.textDim,
              border: "none",
              borderBottom: isUnder ? `2px solid ${active ? COLOR.brand : "transparent"}` : "none",
              borderRadius: isUnder ? 0 : (isSeg ? RADIUS.sm : RADIUS.full),
              cursor: "pointer",
              boxShadow: active && isSeg ? SHADOW.sm : "none",
              transition: `all ${MOTION.fast} ${MOTION.ease}`,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (active) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = COLOR.text;
              if (!isUnder) el.style.background = COLOR.surface2;
            }}
            onMouseLeave={e => {
              if (active) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = COLOR.textDim;
              if (!isUnder) el.style.background = "transparent";
            }}
          >
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Modal (desktop) / Sheet (mobile)
   ═══════════════════════════════════════════════════════════ */

export function Modal({ open, onClose, title, children, footer, size = "md",
  sheetOnMobile = true }:
  { open: boolean; onClose: () => void; title?: React.ReactNode;
    children: React.ReactNode; footer?: React.ReactNode;
    size?: "sm"|"md"|"lg"|"xl"; sheetOnMobile?: boolean }) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus first focusable inside modal
    const el = shellRef.current;
    if (el) {
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === "sm" ? 400 : size === "lg" ? 720 : size === "xl" ? 960 : 540;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 520;
  const asSheet = sheetOnMobile && isMobile;

  return (
    <>
      <div className="cc-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={{
          position: "fixed",
          inset: asSheet ? "auto 0 0 0" : 0,
          zIndex: Z.modal,
          display: "flex",
          alignItems: asSheet ? "flex-end" : "center",
          justifyContent: "center",
          padding: asSheet ? 0 : SPACE[4],
          pointerEvents: "none",
        }}
      >
        <div
          ref={shellRef}
          className={asSheet ? "cc-sheet-shell" : "cc-modal-shell"}
          style={{
            pointerEvents: "auto",
            background: COLOR.surface1,
            border: `1px solid ${COLOR.border}`,
            borderRadius: asSheet ? `${RADIUS.xl}px ${RADIUS.xl}px 0 0` : RADIUS.xl,
            boxShadow: SHADOW.xl,
            width: "100%",
            maxWidth: asSheet ? "100%" : maxW,
            maxHeight: asSheet ? "85vh" : "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          {asSheet && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
              <div style={{ width: 44, height: 4, borderRadius: 999, background: COLOR.borderStrong }} />
            </div>
          )}
          {title !== undefined && (
            <div style={{
              display: "flex", alignItems: "center", gap: SPACE[3],
              padding: `${SPACE[4]}px ${SPACE[5]}px`,
              borderBottom: `1px solid ${COLOR.border}`,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLOR.text, flex: 1 }}>{title}</div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="cc-focus-ring"
                style={{
                  width: 32, height: 32, borderRadius: RADIUS.md,
                  background: "transparent", border: "none", cursor: "pointer",
                  color: COLOR.textDim, display: "inline-flex", alignItems: "center",
                  justifyContent: "center", fontSize: 20, lineHeight: 1,
                }}
              >×</button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: `${SPACE[4]}px ${SPACE[5]}px` }}>
            {children}
          </div>
          {footer && (
            <div style={{
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderTop: `1px solid ${COLOR.border}`,
              background: COLOR.surface2,
              display: "flex", gap: SPACE[2], justifyContent: "flex-end", flexWrap: "wrap",
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tooltip
   ═══════════════════════════════════════════════════════════ */

export function Tooltip({ label, children, placement = "top" }:
  { label: string; children: React.ReactElement; placement?: "top"|"bottom"|"left"|"right" }) {
  // Keep it simple: delegate to native title; rich tooltip impl can come later.
  return React.cloneElement(children as any, { title: label });
}

/* ═══════════════════════════════════════════════════════════
   Spinner
   ═══════════════════════════════════════════════════════════ */

export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: "cc-spin 0.8s linear infinite" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity={0.2} strokeWidth="3"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Icon set (inline SVG, no deps)
   ═══════════════════════════════════════════════════════════ */

export const Icon = {
  Play: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...p}><path d="M8 5v14l11-7z"/></svg>
  ),
  Pause: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...p}><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
  ),
  Close: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="16" height="16" {...p}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
  ),
  Check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polyline points="20,6 9,17 4,12"/></svg>
  ),
  Sound: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
  ),
  Mute: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
  ),
  Help: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  Settings: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  User: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Bot: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/><line x1="12" y1="3" x2="12" y2="7"/></svg>
  ),
  Trophy: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...p}><path d="M7 3h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3zm-3 1h3v2a3 3 0 0 1-3-3V4zm13 0h3v1a3 3 0 0 1-3 3V4zM9 13h6v2l2 5H7l2-5v-2z"/></svg>
  ),
  Coin: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" {...p}><circle cx="12" cy="12" r="9" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5"/><text x="12" y="16" fontSize="11" fontWeight="900" textAnchor="middle" fill="#78350f">C</text></svg>
  ),
  Target: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
  ),
  Flame: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...p}><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-1 5 3 5 3 1 0-3-2-4 0-7z"/></svg>
  ),
  Chevron: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polyline points="9 18 15 12 9 6"/></svg>
  ),
  Share: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  ),
  Eye: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Flip: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
  ),
  Undo: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
  ),
  Lightbulb: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c1 .8 1.5 1.7 1.5 2.8V18h5v-.5c0-1.1.5-2 1.5-2.8A7 7 0 0 0 12 2z"/></svg>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Chessy gain float animation
   ═══════════════════════════════════════════════════════════ */

export function ChessyFloat({ amount, onDone }: { amount: number; onDone: () => void }) {
  const timer = useRef<any>(null);
  useEffect(() => {
    timer.current = setTimeout(onDone, 1600);
    return () => clearTimeout(timer.current);
  }, [onDone]);
  return (
    <div
      className="cc-float-plus"
      style={{
        position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)",
        zIndex: Z.toast, fontSize: 28, fontWeight: 900,
        color: COLOR.gold, textShadow: "0 2px 12px rgba(217,119,6,0.5)",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}
      aria-live="polite"
    >
      +{amount} <Icon.Coin width={24} height={24} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Confetti — fires when player wins. Pure CSS, no deps.
   Self-cleans after 3s via onDone.
   ═══════════════════════════════════════════════════════════ */

export function Confetti({ onDone, count = 80 }: { onDone: () => void; count?: number }) {
  const timer = useRef<any>(null);
  useEffect(() => {
    timer.current = setTimeout(onDone, 3200);
    return () => clearTimeout(timer.current);
  }, [onDone]);
  // Generate pieces once on mount (stable refs prevent re-render flicker)
  const pieces = useRef<Array<{ left: number; delay: number; color: string; rotate: number; sway: number }>>([]);
  if (pieces.current.length === 0) {
    const colors = ["#fbbf24", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#ef4444", "#f97316"];
    for (let i = 0; i < count; i++) {
      pieces.current.push({
        left: Math.random() * 100,
        delay: Math.random() * 600,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotate: Math.random() * 360,
        sway: (Math.random() - 0.5) * 200,
      });
    }
  }
  return (
    <div className="cc-confetti" aria-hidden="true">
      {pieces.current.map((p, i) => (
        <span
          key={i}
          className="cc-confetti-piece"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            animationDelay: `${p.delay}ms`,
            transform: `rotate(${p.rotate}deg) translateX(${p.sway}px)`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section heading
   ═══════════════════════════════════════════════════════════ */

export function SectionHeader({ title, icon, action, hint }:
  { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: SPACE[2],
      marginBottom: SPACE[2], minHeight: 24,
    }}>
      {icon}
      <div style={{ fontSize: 13, fontWeight: 800, color: COLOR.text, letterSpacing: 0.2 }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 12, color: COLOR.textDim, fontWeight: 600 }}>{hint}</div>}
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Helper: useEscClose
   ═══════════════════════════════════════════════════════════ */

export function useEscClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}
