"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAdvance,
  newAdvance as createAdvance,
  saveAdvance,
  type Advance,
} from "../_lib/advance";

const TICK_INTERVAL_MS = 4000;
const TICK_RATE = 0.01;

export function useAdvance() {
  const [advance, setAdvance] = useState<Advance | null>(null);
  const advanceRef = useRef<Advance | null>(null);
  advanceRef.current = advance;

  useEffect(() => {
    setAdvance(loadAdvance());
  }, []);

  useEffect(() => {
    saveAdvance(advance);
  }, [advance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const a = advanceRef.current;
      if (!a || a.outstanding <= 0 || a.closedAt) return;
      if (document.visibilityState === "hidden") return;
      const step = Math.max(0.01, Math.min(a.outstanding, a.principal * TICK_RATE));
      const nextOutstanding = +(a.outstanding - step).toFixed(2);
      const closed = nextOutstanding <= 0;
      setAdvance({
        ...a,
        outstanding: closed ? 0 : nextOutstanding,
        repayments: [
          ...a.repayments,
          { amount: step, at: new Date().toISOString(), kind: "auto" },
        ].slice(-30),
        closedAt: closed ? new Date().toISOString() : a.closedAt,
      });
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const request = useCallback((principal: number) => {
    setAdvance(createAdvance(principal));
  }, []);

  const repayManual = useCallback((amount: number) => {
    setAdvance((prev) => {
      if (!prev || amount <= 0) return prev;
      const nextOutstanding = +(Math.max(0, prev.outstanding - amount)).toFixed(2);
      const closed = nextOutstanding <= 0;
      return {
        ...prev,
        outstanding: nextOutstanding,
        repayments: [
          ...prev.repayments,
          { amount, at: new Date().toISOString(), kind: "manual" },
        ].slice(-30),
        closedAt: closed ? new Date().toISOString() : prev.closedAt,
      };
    });
  }, []);

  const close = useCallback(() => {
    setAdvance(null);
  }, []);

  return { advance, request, repayManual, close };
}
