"use client";

import { useProgress } from "../lib/useProgress";
import { useSyncProgress } from "../lib/useSyncProgress";

/** Renders nothing — syncs localStorage progress to server on changes. */
export function ProgressSync() {
  const { progress } = useProgress();
  useSyncProgress(progress);
  return null;
}
