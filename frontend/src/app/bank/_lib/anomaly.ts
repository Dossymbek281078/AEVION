// Anomaly detection over banking operations. Pure client-side heuristics —
// no ML, no backend. Tuned for "looks suspicious enough to surface" not "100% certain".

import type { Operation } from "./types";

export type AnomalyKind = "large" | "newRecipient" | "burst" | "lateNight";

export type Anomaly = {
  kind: AnomalyKind;
  message: string;
  severity: "low" | "medium" | "high";
};

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  large: "Large",
  newRecipient: "New recipient",
  burst: "Burst",
  lateNight: "Late-night",
};

export const ANOMALY_COLOR: Record<AnomalyKind, string> = {
  large: "#dc2626",
  newRecipient: "#d97706",
  burst: "#7c3aed",
  lateNight: "#0369a1",
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function counterparty(op: Operation, myId: string): string | null {
  if (op.kind === "topup") return null;
  return op.to === myId ? op.from : op.to;
}

export function detectAnomalies(op: Operation, history: Operation[], myId: string): Anomaly[] {
  if (op.kind !== "transfer" || op.from !== myId) return [];
  const out: Anomaly[] = [];

  const outgoings = history.filter(
    (h) => h.id !== op.id && h.kind === "transfer" && h.from === myId,
  );
  const med = median(outgoings.map((h) => h.amount));

  if (med > 0 && op.amount > med * 3) {
    out.push({
      kind: "large",
      message: `${(op.amount / med).toFixed(1)}× your typical transfer`,
      severity: op.amount > med * 6 ? "high" : "medium",
    });
  }

  const cp = counterparty(op, myId);
  if (cp) {
    const opTs = new Date(op.createdAt).getTime();
    const seenBefore = history.some(
      (h) =>
        h.id !== op.id &&
        new Date(h.createdAt).getTime() < opTs &&
        (counterparty(h, myId) === cp),
    );
    if (!seenBefore) {
      out.push({
        kind: "newRecipient",
        message: "First transfer to this account",
        severity: "low",
      });
    }
  }

  const opTs = new Date(op.createdAt).getTime();
  const window = 5 * 60_000;
  const burstCount = history.filter(
    (h) =>
      h.id !== op.id &&
      h.kind === "transfer" &&
      h.from === myId &&
      Math.abs(new Date(h.createdAt).getTime() - opTs) <= window,
  ).length + 1;
  if (burstCount >= 3) {
    out.push({
      kind: "burst",
      message: `${burstCount} outgoing in 5 min`,
      severity: burstCount >= 5 ? "high" : "medium",
    });
  }

  const date = new Date(op.createdAt);
  const hour = date.getHours();
  if (hour >= 2 && hour < 5) {
    out.push({
      kind: "lateNight",
      message: `Late-night activity at ${hour.toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
      severity: "low",
    });
  }

  return out;
}
