"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "aevion-smeta-lesson-bookmarks-v1";

export function loadBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmarks(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
}

export function useLessonBookmarks() {
  const [bookmarks, setBookmarksState] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBookmarksState(loadBookmarks());
  }, []);

  const toggle = useCallback((lessonId: string) => {
    setBookmarksState((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const has = useCallback((lessonId: string) => bookmarks.has(lessonId), [bookmarks]);

  return { bookmarks, toggle, has };
}
