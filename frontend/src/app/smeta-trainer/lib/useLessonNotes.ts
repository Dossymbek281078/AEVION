"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "aevion-smeta-lesson-notes-v1";

/** Все заметки: lessonId → текст. */
export function loadAllNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveAll(notes: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {}
}

export function useLessonNotes(lessonId: string) {
  const [note, setNoteState] = useState("");

  useEffect(() => {
    const all = loadAllNotes();
    setNoteState(all[lessonId] ?? "");
  }, [lessonId]);

  const setNote = useCallback(
    (text: string) => {
      setNoteState(text);
      const all = loadAllNotes();
      if (text.trim()) {
        all[lessonId] = text;
      } else {
        delete all[lessonId];
      }
      saveAll(all);
    },
    [lessonId],
  );

  return { note, setNote };
}
