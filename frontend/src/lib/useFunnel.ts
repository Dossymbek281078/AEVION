"use client";

import { useCallback, useRef } from "react";

/**
 * useFunnel — fire-and-forget event tracking for Constitution.
 *
 * Sends POST /api/constitution/funnel/track with event + optional props.
 * Failures are silent (analytics never blocks UI). Throttles same event
 * within 1s to avoid slider-change spam.
 */

export type ConstitutionEvent =
  | "page_view"
  | "slider_change"
  | "save_clicked"
  | "save_success"
  | "qsign_clicked"
  | "planet_publish"
  | "pdf_download"
  | "ai_suggest"
  | "upgrade_click"
  | "upgrade_complete"
  | "tour_started"
  | "tour_completed"
  | "academy_lesson_done"
  | "academy_cert"
  | "blog_view"
  | "embed_view"
  | "comment_posted"
  | "vote_cast";

const THROTTLE_MS = 1000;

export function useFunnel() {
  const lastFired = useRef<Map<string, number>>(new Map());

  const track = useCallback(
    (event: ConstitutionEvent, props?: Record<string, string | number | boolean>) => {
      const now = Date.now();
      const last = lastFired.current.get(event);
      if (last && now - last < THROTTLE_MS) return;
      lastFired.current.set(event, now);
      try {
        const body = JSON.stringify({ event, props: props ?? {} });
        // Use sendBeacon when possible — survives page unload
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon("/api-backend/api/constitution/funnel/track", blob);
          return;
        }
        void fetch("/api-backend/api/constitution/funnel/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => { /* ignore */ });
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { track };
}
