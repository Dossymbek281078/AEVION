// Pure merger: operations + QSign signatures + Autopilot actions + Freeze log
// → one chronological AuditEntry[] that drives UnifiedAuditFeed.
//
// Each source already lives in its own storage; this builder is stateless —
// just normalises all four into the AuditEntry shape and sorts by timestamp.

import type { AutopilotAction } from "./autopilot";
import type { FreezeEvent } from "./freeze";
import type { SignedOperation } from "./signatures";
import type { Operation } from "./types";

export type AuditSource = "operation" | "signature" | "autopilot" | "freeze";

export const SOURCE_COLOR: Record<AuditSource, string> = {
  operation: "#0ea5e9",
  signature: "#0f766e",
  autopilot: "#059669",
  freeze: "#dc2626",
};

export const SOURCE_LABEL: Record<AuditSource, string> = {
  operation: "Transfer",
  signature: "QSign",
  autopilot: "Autopilot",
  freeze: "Freeze",
};

export type AuditEntry = {
  id: string;
  at: string; // ISO
  source: AuditSource;
  icon: string;
  title: string;
  subtitle: string;
  amountAec?: number;
  /** Accent override — e.g. signature state colour when "invalid". */
  accent?: string;
  /** Raw payload reference — useful for deep export. */
  raw: unknown;
};

function entryFromOperation(op: Operation, myAccountId: string): AuditEntry {
  if (op.kind === "topup") {
    return {
      id: `op_${op.id}`,
      at: op.createdAt,
      source: "operation",
      icon: "+",
      title: `Top-up +${op.amount.toFixed(2)} AEC`,
      subtitle: `id ${op.id.slice(0, 10)}…`,
      amountAec: op.amount,
      raw: op,
    };
  }
  const outgoing = op.from === myAccountId;
  const counterparty = outgoing ? op.to : op.from ?? "";
  return {
    id: `op_${op.id}`,
    at: op.createdAt,
    source: "operation",
    icon: outgoing ? "↗" : "↙",
    title: `${outgoing ? "Sent" : "Received"} ${op.amount.toFixed(2)} AEC`,
    subtitle: `${outgoing ? "to" : "from"} ${counterparty ? counterparty.slice(0, 16) + "…" : "unknown"}`,
    amountAec: outgoing ? -op.amount : op.amount,
    raw: op,
  };
}

function entryFromSignature(sig: SignedOperation): AuditEntry {
  const stateAccent: Record<string, string | undefined> = {
    valid: "#059669",
    invalid: "#dc2626",
    error: "#d97706",
    unknown: undefined,
  };
  return {
    id: `sig_${sig.id}`,
    at: sig.signedAt,
    source: "signature",
    icon: "✎",
    title: `QSign · ${sig.kind} signed`,
    subtitle: `${sig.algo} · ${sig.verified}${sig.verifiedAt ? ` · checked` : ""}`,
    accent: stateAccent[sig.verified],
    raw: sig,
  };
}

function entryFromAutopilot(a: AutopilotAction): AuditEntry {
  return {
    id: `ap_${a.id}`,
    at: a.at,
    source: "autopilot",
    icon: "⚡",
    title: `Autopilot · ${a.note}`,
    subtitle: `Target: ${a.targetLabel}`,
    amountAec: a.amount,
    raw: a,
  };
}

function entryFromFreeze(fe: FreezeEvent): AuditEntry {
  const manual = fe.reason === "manual";
  return {
    id: `fz_${fe.id}`,
    at: fe.at,
    source: "freeze",
    icon: fe.type === "freeze" ? "🔒" : "🔓",
    title:
      fe.type === "freeze"
        ? `Wallet frozen · ${manual ? "manual" : "anomaly"}`
        : `Wallet unfrozen`,
    subtitle: fe.note ?? (manual ? "User-initiated" : "Auto-watchdog"),
    raw: fe,
  };
}

export function buildUnifiedFeed({
  operations,
  signatures,
  autopilotActions,
  freezeLog,
  myAccountId,
  limit = 60,
}: {
  operations: Operation[];
  signatures: SignedOperation[];
  autopilotActions: AutopilotAction[];
  freezeLog: FreezeEvent[];
  myAccountId: string;
  limit?: number;
}): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const op of operations) entries.push(entryFromOperation(op, myAccountId));
  for (const s of signatures) entries.push(entryFromSignature(s));
  for (const a of autopilotActions) entries.push(entryFromAutopilot(a));
  for (const fe of freezeLog) entries.push(entryFromFreeze(fe));
  entries.sort((x, y) => {
    const tx = Date.parse(x.at);
    const ty = Date.parse(y.at);
    return (Number.isFinite(ty) ? ty : 0) - (Number.isFinite(tx) ? tx : 0);
  });
  return entries.slice(0, limit);
}
