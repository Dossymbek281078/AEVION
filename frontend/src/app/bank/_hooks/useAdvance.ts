"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAdvance,
  newAdvance as createAdvance,
  saveAdvance,
  type Advance,
} from "../_lib/advance";
import type { Operation } from "../_lib/types";

// Fraction of each incoming transfer automatically applied to the
// outstanding advance. Matches the "save half of income" heuristic the
// advisor copy uses elsewhere.
const INCOMING_SWEEP_RATIO = 0.5;

type Options = {
  accountId: string | null;
  operations: Operation[];
};

function isIncoming(op: Operation, accountId: string): boolean {
  return op.to === accountId && op.amount > 0;
}

export function useAdvance({ accountId, operations }: Options = { accountId: null, operations: [] }) {
  const [advance, setAdvance] = useState<Advance | null>(null);
  const advanceRef = useRef<Advance | null>(null);
  advanceRef.current = advance;
  const seenOpsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef<boolean>(false);

  useEffect(() => {
    setAdvance(loadAdvance());
  }, []);

  useEffect(() => {
    saveAdvance(advance);
  }, [advance]);

  // Bootstrap: on first operations snapshot, mark everything as already
  // seen. We only auto-repay from ops that arrive after the advance was
  // taken + already observed by the client.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (!accountId || operations.length === 0) return;
    for (const op of operations) seenOpsRef.current.add(op.id);
    bootstrappedRef.current = true;
  }, [accountId, operations]);

  // Real auto-repay: whenever operations change, find *new* incoming
  // transfers/top-ups since our last pass and sweep a fraction of each
  // into the outstanding advance. One atomic state write per batch.
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    if (!accountId) return;
    const current = advanceRef.current;
    if (!current || current.outstanding <= 0 || current.closedAt) return;

    const fresh: Operation[] = [];
    for (const op of operations) {
      if (seenOpsRef.current.has(op.id)) continue;
      if (isIncoming(op, accountId)) fresh.push(op);
      seenOpsRef.current.add(op.id);
    }
    if (fresh.length === 0) return;

    let outstanding = current.outstanding;
    const newRepayments = current.repayments.slice();
    for (const op of fresh) {
      if (outstanding <= 0) break;
      const sweep = Math.min(outstanding, +(op.amount * INCOMING_SWEEP_RATIO).toFixed(2));
      if (sweep <= 0) continue;
      outstanding = +(outstanding - sweep).toFixed(2);
      newRepayments.push({
        amount: sweep,
        at: op.createdAt || new Date().toISOString(),
        kind: "auto",
      });
    }
    const closed = outstanding <= 0;
    setAdvance({
      ...current,
      outstanding: closed ? 0 : outstanding,
      repayments: newRepayments.slice(-30),
      closedAt: closed ? new Date().toISOString() : current.closedAt,
    });
  }, [accountId, operations]);

  const request = useCallback((principal: number) => {
    // When a new advance is taken, the operations list at that moment is
    // the baseline — nothing earlier should auto-repay it.
    seenOpsRef.current = new Set(operations.map((op) => op.id));
    setAdvance(createAdvance(principal));
  }, [operations]);

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
