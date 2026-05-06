"use client";
/**
 * CommandPalette — Ctrl/Cmd+K palette to fuzzy-search and run any action.
 *
 * Replaces "all features hidden in deep menus" with a single discoverable surface.
 * Inspired by VS Code, Linear, Slack — every shortcut chess app needs but no chess
 * site (lichess / chess.com) actually has.
 *
 * Usage from page.tsx:
 *   const [palOpen, sPalOpen] = useState(false);
 *   useEffect(() => {
 *     const h = (e: KeyboardEvent) => {
 *       if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); sPalOpen(o => !o); }
 *     };
 *     window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
 *   }, []);
 *   <CommandPalette open={palOpen} onClose={() => sPalOpen(false)} commands={[...]} />
 */

import React, { useEffect, useRef, useState, useMemo } from "react";

export type Command = {
  id: string;
  label: string;
  hint?: string;     // small subtitle on the right
  group?: string;    // visual group separator
  hotkey?: string;   // shown as kbd badge
  icon?: string;     // emoji
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

/**
 * Lightweight subsequence fuzzy match — returns a score (lower = better) or -1.
 * Bonuses: prefix match, word-boundary match, consecutive chars.
 */
function fuzzyScore(q: string, target: string): number {
  if (!q) return 0;
  const Q = q.toLowerCase();
  const T = target.toLowerCase();
  if (T.startsWith(Q)) return -100;
  if (T.includes(Q)) return -50 + T.indexOf(Q);
  // subsequence
  let qi = 0, score = 0, lastIdx = -2, prevWasBoundary = false;
  for (let i = 0; i < T.length && qi < Q.length; i++) {
    if (T[i] === Q[qi]) {
      const isBoundary = i === 0 || /[\s\-_·.]/.test(T[i - 1]);
      score += i - lastIdx; // gap penalty
      if (isBoundary) score -= 5;
      if (i === lastIdx + 1 && prevWasBoundary === false) score -= 2; // consecutive bonus
      lastIdx = i;
      prevWasBoundary = isBoundary;
      qi++;
    }
  }
  if (qi < Q.length) return -1; // not all chars matched
  return score;
}

const RECENT_KEY = "aevion_chess_palette_recent_v1";
const RECENT_MAX = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(RECENT_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveRecent(ids: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX))); } catch {}
}

export default function CommandPalette({ open, onClose, commands }: Props) {
  const [q, sQ] = useState("");
  const [idx, sIdx] = useState(0);
  const [recent, sRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open + reload recent list (lets new entries persisted in localStorage propagate)
  useEffect(() => {
    if (open) {
      sQ("");
      sIdx(0);
      sRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Wrap each command's `run` so executing it also pushes the id to the recent list.
  const exec = (c: Command) => {
    const next = [c.id, ...recent.filter(id => id !== c.id)].slice(0, RECENT_MAX);
    sRecent(next);
    saveRecent(next);
    onClose();
    setTimeout(() => c.run(), 0);
  };

  // Filter + score. Empty query → show recent first (in order), then the rest.
  const filtered = useMemo(() => {
    if (!q.trim()) {
      const seen = new Set<string>();
      const out: Command[] = [];
      for (const id of recent) {
        const c = commands.find(x => x.id === id);
        if (c && !seen.has(c.id)) { out.push(c); seen.add(c.id); }
      }
      for (const c of commands) {
        if (out.length >= 14) break;
        if (!seen.has(c.id)) { out.push(c); seen.add(c.id); }
      }
      return out;
    }
    return commands
      .map(c => ({ c, s: fuzzyScore(q.trim(), `${c.label} ${c.hint || ""}`) }))
      .filter(x => x.s !== -1)
      .sort((a, b) => a.s - b.s)
      .slice(0, 14)
      .map(x => x.c);
  }, [q, commands, recent]);

  // Clamp idx within filtered range
  useEffect(() => { if (idx >= filtered.length) sIdx(Math.max(0, filtered.length - 1)); }, [filtered.length, idx]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-i="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sIdx(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sIdx(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[idx];
      if (cmd) exec(cmd);
    } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9500,
      background: "rgba(15,23,42,0.55)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh",
      animation: "fadeInUp 0.18s ease-out",
    }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={onKey}
        style={{
          width: "min(620px, 92vw)",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.12)",
          border: "1px solid rgba(15,23,42,0.08)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}>
          <span style={{ fontSize: 18, color: "#94a3b8" }}>⌕</span>
          <input ref={inputRef} value={q} onChange={e => { sQ(e.target.value); sIdx(0); }}
            placeholder="Поиск команды… (e.g. quick start, premove, lichess, workspace stream)"
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent", fontSize: 16, color: "#0f172a",
              fontFamily: "ui-sans-serif, system-ui",
            }}/>
          <kbd style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 10,
            padding: "3px 7px", borderRadius: 5, background: "#f1f5f9",
            color: "#64748b", fontWeight: 800, border: "1px solid #cbd5e1",
          }}>esc</kbd>
        </div>

        {/* Result list */}
        <div ref={listRef} style={{
          maxHeight: "52vh", overflowY: "auto",
          padding: "6px 6px 8px",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px 18px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              Ничего не найдено для «{q}»
            </div>
          ) : filtered.map((c, i) => {
            const active = i === idx;
            // When no query, items 0..(recent.length-1) come from recent list.
            const isRecent = !q.trim() && i < recent.length && recent.includes(c.id);
            const showRecentHeader = isRecent && i === 0;
            const showAllHeader = !q.trim() && i === recent.length && recent.length > 0;
            return (
              <React.Fragment key={c.id}>
                {showRecentHeader && (
                  <div style={{ padding: "6px 12px 4px", fontSize: 9.5, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>
                    Недавние
                  </div>
                )}
                {showAllHeader && (
                  <div style={{ padding: "8px 12px 4px", fontSize: 9.5, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>
                    Все команды
                  </div>
                )}
              <button data-cmd-i={i}
                onMouseEnter={() => sIdx(i)}
                onClick={() => exec(c)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  border: "none", borderRadius: 8,
                  background: active ? "#f1f5f9" : "transparent",
                  cursor: "pointer", textAlign: "left",
                  transition: "background 0.08s ease",
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: active ? "#fff" : "#f8fafc",
                  border: "1px solid rgba(15,23,42,0.08)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>{c.icon || "·"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>{c.label}</div>
                  {c.hint && <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3, marginTop: 1 }}>{c.hint}</div>}
                </div>
                {c.group && <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                  textTransform: "uppercase",
                  padding: "2px 7px", borderRadius: 4,
                  background: "#eef2ff", color: "#4338ca",
                }}>{c.group}</span>}
                {c.hotkey && <kbd style={{
                  fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 10,
                  padding: "2px 7px", borderRadius: 4, background: "#f1f5f9",
                  color: "#64748b", fontWeight: 800, border: "1px solid #cbd5e1",
                  whiteSpace: "nowrap",
                }}>{c.hotkey}</kbd>}
              </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer hints */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "8px 14px",
          background: "#f8fafc", borderTop: "1px solid rgba(15,23,42,0.08)",
          fontSize: 10.5, color: "#64748b", fontWeight: 600,
        }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> навигация</span>
          <span><kbd style={kbdStyle}>↵</kbd> запустить</span>
          <span><kbd style={kbdStyle}>esc</kbd> закрыть</span>
          <span style={{ flex: 1 }}/>
          <span style={{ opacity: 0.7 }}>Команд: {commands.length}</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 9.5, fontWeight: 800,
  padding: "1px 5px", borderRadius: 3,
  background: "#fff", color: "#475569", border: "1px solid #cbd5e1",
};
