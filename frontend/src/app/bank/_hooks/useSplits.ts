"use client";

import { useCallback } from "react";
import { loadSplits, saveSplits, type SplitBill, type SplitShare } from "../_lib/splits";
import { useLocalList } from "./useLocalList";

function newId(): string {
  return `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSplits() {
  const { items, setItems, add: pushItem, removeWhere } = useLocalList<SplitBill>({
    load: loadSplits,
    save: saveSplits,
  });

  const add = useCallback(
    (label: string, totalAec: number, shares: SplitShare[]): SplitBill => {
      const b: SplitBill = {
        id: newId(),
        label: label.trim(),
        totalAec,
        createdAt: new Date().toISOString(),
        shares,
      };
      pushItem(b);
      return b;
    },
    [pushItem],
  );

  const remove = useCallback(
    (id: string) => removeWhere((b) => b.id === id),
    [removeWhere],
  );

  const togglePaid = useCallback(
    (billId: string, shareAccountId: string) => {
      setItems((prev) =>
        prev.map((b) => {
          if (b.id !== billId) return b;
          return {
            ...b,
            shares: b.shares.map((s) =>
              s.accountId === shareAccountId
                ? {
                    ...s,
                    paid: !s.paid,
                    paidAt: !s.paid ? new Date().toISOString() : null,
                  }
                : s,
            ),
          };
        }),
      );
    },
    [setItems],
  );

  return { items, add, remove, togglePaid };
}
