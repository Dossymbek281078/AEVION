"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPeriod,
  loadRecurring,
  saveRecurring,
  type Recurring,
  type RecurrencePeriod,
} from "../_lib/recurring";

const EXECUTOR_INTERVAL_MS = 30_000;

type ToastType = "success" | "error" | "info";

type Options = {
  send: (to: string, amount: number) => Promise<boolean>;
  notify: (msg: string, type?: ToastType) => void;
};

type CreateInput = {
  toAccountId: string;
  recipientNickname: string;
  amount: number;
  period: RecurrencePeriod;
  label: string;
  startsAt: string;
};

function newId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useRecurring(opts: Options) {
  const [items, setItems] = useState<Recurring[]>([]);
  const itemsRef = useRef<Recurring[]>(items);
  itemsRef.current = items;
  const optsRef = useRef<Options>(opts);
  optsRef.current = opts;
  const runningRef = useRef<boolean>(false);

  useEffect(() => {
    setItems(loadRecurring());
  }, []);

  useEffect(() => {
    saveRecurring(items);
  }, [items]);

  const runDue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const now = Date.now();
      const due = itemsRef.current.filter(
        (r) => r.active && new Date(r.nextRunAt).getTime() <= now,
      );
      for (const r of due) {
        const ok = await optsRef.current.send(r.toAccountId, r.amount).catch(() => false);
        if (ok) {
          const ranAt = new Date();
          const next = addPeriod(ranAt, r.period);
          setItems((prev) =>
            prev.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    lastRunAt: ranAt.toISOString(),
                    nextRunAt: next.toISOString(),
                    runs: x.runs + 1,
                  }
                : x,
            ),
          );
          optsRef.current.notify(`Recurring "${r.label}" sent`, "success");
        } else {
          setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: false } : x)));
          optsRef.current.notify(`Recurring "${r.label}" failed — paused`, "error");
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    void runDue();
    const id = window.setInterval(() => {
      void runDue();
    }, EXECUTOR_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [runDue]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "visible") void runDue();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [runDue]);

  const add = useCallback((input: CreateInput): Recurring => {
    const now = new Date();
    const starts = input.startsAt ? new Date(input.startsAt) : now;
    const rec: Recurring = {
      id: newId(),
      toAccountId: input.toAccountId.trim(),
      recipientNickname: input.recipientNickname.trim(),
      amount: input.amount,
      period: input.period,
      label: input.label.trim(),
      startsAt: starts.toISOString(),
      nextRunAt: starts.toISOString(),
      lastRunAt: null,
      active: true,
      createdAt: now.toISOString(),
      runs: 0,
    };
    setItems((prev) => [rec, ...prev]);
    return rec;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggle = useCallback((id: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }, []);

  return { items, add, remove, toggle, runNow: runDue };
}
