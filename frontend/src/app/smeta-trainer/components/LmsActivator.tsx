"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useProgress } from "../lib/useProgress";
import { LEVELS } from "../lib/levels";

interface Props {
  currentLevel: number;
}

/**
 * Reads ?lesson=урок-2-X from URL and marks the current level as visited.
 * Used for LMS deep-links: after a student completes a lesson in the LMS,
 * they are redirected to /smeta-trainer/level/N?lesson=урок-2-N.
 */
export function LmsActivator({ currentLevel }: Props) {
  const searchParams = useSearchParams();
  const { markVisit } = useProgress();

  useEffect(() => {
    const lesson = searchParams.get("lesson");
    if (!lesson) return;
    const levelDef = LEVELS.find((l) => l.lessonRef === lesson);
    if (levelDef && levelDef.num === currentLevel) {
      markVisit(currentLevel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
