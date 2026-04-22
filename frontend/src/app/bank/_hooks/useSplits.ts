"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSplits, saveSplits, type SplitBill, type SplitShare } from "../_lib/splits";

function newId(): string {
  return `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSplits() {
  const [items, setItems] = useState<SplitBill[]>([]);

  useEffect(() => {
    setItems(loadSplits());
  }, []);

  useEffect(() => {
    saveSplits(items);
  }, [items]);

  const add = useCallback((label: string, totalAec: number, shares: SplitShare[]): SplitBill => {
    const b: SplitBill = {
      id: newId(),
      label: label.trim(),
      totalAec,
      createdAt: new Date().toISOString(),
      shares,
    };
    setItems((prev) => [b, ...prev]);
    return b;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const togglePaid = useCallback((billId: string, shareAccountId: string) => {
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
  }, []);

  return { items, add, remove, togglePaid };
}
