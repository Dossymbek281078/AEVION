"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps text that was typed before React hydrated.
 *
 * A page can be visible and focusable long before its JavaScript has run. Keys
 * pressed in that window land in the DOM, but no `onChange` has fired, so React
 * state is still empty — and the first render after hydration writes that empty
 * state back over what the person wrote. Nothing errors; the text simply
 * vanishes, usually a second or two after they typed it.
 *
 * Measured on /devhub (28.07.2026): the input node was never replaced and its
 * value was blanked ~3s in, right after the first data-driven re-render. On a
 * slow phone the hydration window is seconds long, so this is a real loss, not
 * a test artifact.
 *
 * Mark the fields with `data-prehydration-field="<state key>"`, point this hook
 * at a container around them, and whatever is already in the DOM at mount is
 * adopted into state. Effects run after the hydration commit but before that
 * later re-render, so the read happens while the characters are still there.
 */
export function useAdoptPreHydrationValues(
  ref: RefObject<HTMLElement | null>,
  apply: (typed: Record<string, string>) => void,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const typed: Record<string, string> = {};
    root
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-prehydration-field]")
      .forEach((el) => {
        const key = el.dataset.prehydrationField;
        // Only non-empty values: an empty field carries no intent, and copying
        // it over would be a pointless state update on every mount.
        if (key && el.value) typed[key] = el.value;
      });

    if (Object.keys(typed).length > 0) apply(typed);
    // Deliberately mount-only: this is about the one gap between paint and
    // hydration. After that, onChange is attached and owns every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
