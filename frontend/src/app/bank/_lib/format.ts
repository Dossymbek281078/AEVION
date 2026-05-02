import type { Operation } from "./types";

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function formatAmount(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} AEC`;
}

export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export type DescribedOp = {
  typeKey: "topup" | "transfer";
  label: string;
  description: string;
  signed: number;
  counterparty: string | null;
};

export function describeOp(op: Operation, myId: string): DescribedOp {
  if (op.kind === "topup") {
    return {
      typeKey: "topup",
      label: "Top-up",
      description: "Wallet top-up",
      signed: +op.amount,
      counterparty: null,
    };
  }
  const incoming = op.to === myId;
  const counterparty = incoming ? op.from : op.to;
  return {
    typeKey: "transfer",
    label: incoming ? "Received" : "Sent",
    description: incoming ? `From ${shortId(counterparty)}` : `To ${shortId(counterparty)}`,
    signed: incoming ? +op.amount : -op.amount,
    counterparty,
  };
}

// Walk backwards from current balance, reversing operations by day window.
export function buildSparkline(ops: Operation[], currentBalance: number, myId: string, days = 14): number[] {
  if (!myId) return new Array(days).fill(currentBalance);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const dayMs = 24 * 3600 * 1000;
  const points = new Array<number>(days).fill(0);
  let running = currentBalance;
  points[days - 1] = running;
  for (let j = 1; j < days; j++) {
    const ws = todayEnd - j * dayMs;
    const we = todayEnd - (j - 1) * dayMs;
    for (const op of ops) {
      const t = new Date(op.createdAt).getTime();
      if (!Number.isFinite(t)) continue;
      if (t > ws && t <= we) {
        if (op.to === myId) running -= op.amount;
        if (op.from === myId) running += op.amount;
      }
    }
    points[days - 1 - j] = running;
  }
  return points;
}

export function stats30d(ops: Operation[], myId: string) {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  let netFlow = 0;
  let count = 0;
  let incoming = 0;
  let outgoing = 0;
  for (const op of ops) {
    const t = new Date(op.createdAt).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    count++;
    if (op.to === myId) {
      netFlow += op.amount;
      incoming += op.amount;
    }
    if (op.from === myId) {
      netFlow -= op.amount;
      outgoing += op.amount;
    }
  }
  return { netFlow, count, incoming, outgoing };
}

export function lastActivityMs(ops: Operation[]): number {
  return ops.reduce((latest, op) => {
    const t = new Date(op.createdAt).getTime();
    return Number.isFinite(t) && t > latest ? t : latest;
  }, 0);
}

export function sparklineDelta(points: number[]): number {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === 0) return last === 0 ? 0 : 100;
  return ((last - first) / Math.abs(first)) * 100;
}
