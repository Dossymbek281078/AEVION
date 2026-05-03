"use client";

import { useEffect, useRef } from "react";
import type { CourseProgress } from "./useProgress";

const SESSION_KEY = "aevion-smeta-session-id";
const SYNC_DEBOUNCE_MS = 800;

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

export function useSyncProgress(progress: CourseProgress) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip sync if no meaningful data yet
    if (!progress.studentName && !Object.values(progress.levels).some((l) => l.status !== "open")) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const sessionId = getOrCreateSessionId();
        await fetch("/api/smeta-trainer/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            studentName: progress.studentName,
            studentGroup: progress.studentGroup,
            levelsJson: JSON.stringify(progress.levels),
          }),
        });
      } catch {
        // silent — localStorage is source of truth, server sync is best-effort
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [progress]);
}
