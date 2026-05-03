"use client";

import { useCallback } from "react";
import { GOALS_EVENT, loadGoals, saveGoals, type GoalIcon, type SavingsGoal } from "../_lib/savings";
import { useLocalList } from "./useLocalList";

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
  const { items: goals, setItems, add: pushItem, removeWhere } = useLocalList<SavingsGoal>({
    load: loadGoals,
    save: saveGoals,
    event: GOALS_EVENT,
  });

  const add = useCallback(
    (input: CreateInput): SavingsGoal => {
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
      pushItem(g);
      return g;
    },
    [pushItem],
  );

  const remove = useCallback(
    (id: string) => removeWhere((g) => g.id === id),
    [removeWhere],
  );

  const contribute = useCallback(
    (id: string, delta: number) => {
      setItems((prev) =>
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
    },
    [setItems],
  );

  const reset = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, currentAec: 0, completedAt: null } : g)),
      );
    },
    [setItems],
  );

  return { goals, add, remove, contribute, reset };
}
