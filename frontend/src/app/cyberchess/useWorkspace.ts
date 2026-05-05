"use client";
/**
 * useWorkspace — workspace preset system.
 *
 * Five presets that radically reshape the layout:
 *   1. Focus    — board only, max size, no panels
 *   2. Standard — board + right panel (default)
 *   3. Stream   — board + media pane (YouTube/Twitch/Lichess) + chat
 *   4. Study    — board + multipv + opening tree (analysis-heavy)
 *   5. Coach    — board + Coach predictions + AI advice
 *
 * Persists in localStorage. Switchable via toolbar OR keys 1..5.
 */

import { useEffect, useState, useCallback } from "react";

export type WorkspacePreset = "focus" | "standard" | "stream" | "study" | "coach";

const STORAGE_KEY = "aevion_chess_workspace_v1";
const ALL: WorkspacePreset[] = ["focus", "standard", "stream", "study", "coach"];

export const WORKSPACE_META: Record<WorkspacePreset, { icon: string; name: string; hint: string; key: string }> = {
  focus:    { icon: "◻", name: "Focus",    hint: "Только доска, максимум места", key: "1" },
  standard: { icon: "▦", name: "Standard", hint: "Доска + ходы / eval (по умолчанию)", key: "2" },
  stream:   { icon: "▶",  name: "Stream",   hint: "Доска + YouTube/Twitch/Lichess", key: "3" },
  study:    { icon: "✎", name: "Study",    hint: "Доска + multipv + дебютное дерево", key: "4" },
  coach:    { icon: "🎓", name: "Coach",    hint: "Доска + AI-советник + предсказания", key: "5" },
};

function load(): WorkspacePreset {
  if (typeof window === "undefined") return "standard";
  try {
    const v = localStorage.getItem(STORAGE_KEY) as WorkspacePreset | null;
    return v && ALL.includes(v) ? v : "standard";
  } catch { return "standard"; }
}

export function useWorkspace() {
  const [preset, setPreset] = useState<WorkspacePreset>("standard");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => { setPreset(load()); setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, preset); } catch {}
  }, [preset, hydrated]);

  // Keyboard 1..5 switches preset (skip when typing in inputs/textareas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t && t.isContentEditable) return;
      const idx = "12345".indexOf(e.key);
      if (idx < 0) return;
      e.preventDefault();
      setPreset(ALL[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cycle = useCallback(() => {
    setPreset(p => ALL[(ALL.indexOf(p) + 1) % ALL.length]);
  }, []);

  return {
    preset,
    setPreset,
    cycle,
    // Layout flags consumed by page.tsx — rather than each component reading
    // the preset, page.tsx just reads these booleans and lays out the panels.
    showRightPanel: preset !== "focus",
    showMediaPane:  preset === "stream",
    showCoachPane:  preset === "coach",
    showStudyPane:  preset === "study",
    boardSize:      preset === "focus" ? "max" : "normal",  // page.tsx applies CSS
  };
}
