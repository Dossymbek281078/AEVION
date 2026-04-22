"use client";

import { useCallback, useEffect, useState } from "react";
import { loadGoals, saveGoals, type GoalIcon, type SavingsGoal } from "../_lib/savings";

function newId(): string {
  return `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type CreateInput = {
  label: string;
  icon: GoalIcon;
  targetAec: number;
  deadlineISO: string | null;
};

export function useSavings() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    setGoals(loadGoals());
  }, []);

  useEffect(() => {
    saveGoals(goals);
  }, [goals]);

  const add = useCallback((input: CreateInput): SavingsGoal => {
    const g: SavingsGoal = {
      id: newId(),
      label: input.label.trim(),
      icon: input.icon,
      targetAec: input.targetAec,
      currentAec: 0,
      deadlineISO: input.deadlineISO,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    setGoals((prev) => [g, ...prev]);
    return g;
  }, []);

  const remove = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const contribute = useCallback((id: string, delta: number) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const next = Math.max(0, g.currentAec + delta);
        const justCompleted = next >= g.targetAec && !g.completedAt;
        return {
          ...g,
          currentAec: next,
          completedAt: justCompleted ? new Date().toISOString() : g.completedAt,
        };
      }),
    );
  }, []);

  const reset = useCallback((id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, currentAec: 0, completedAt: null } : g)),
    );
  }, []);

  return { goals, add, remove, contribute, reset };
}
