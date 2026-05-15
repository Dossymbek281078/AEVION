// Smart Notifications — aggregator over anomalies + budget caps + stale
// subscriptions + low balance + mature vault positions + expiring challenges.
// Each note has a stable id so dismissals persist across page loads.

import { detectAnomalies } from "./anomaly";
import { evaluateCaps, loadBudgetCaps } from "./budgetCaps";
import { evaluateAll as evaluateChallenges } from "./challenges";
import { scanRecurring } from "./subscriptionScan";
import { loadRecurring } from "./recurring";
import { isMature, loadVault, timeLeftHours } from "./vault";
import type { Account, Operation } from "./types";

const STORAGE_KEY = "aevion_bank_notif_dismissed_v1";
export const NOTIF_EVENT = "aevion:notif-changed";

export type NotifSeverity = "low" | "medium" | "high";

export type NotifAction = {
  labelKey: string;
  /** scrollMarginTop anchor id within /bank */
  anchor?: string;
};

export type Notification = {
  id: string;
  severity: NotifSeverity;
  titleKey: string;
  titleVars?: Record<string, string | number>;
  bodyKey: string;
  bodyVars?: Record<string, string | number>;
  action?: NotifAction;
};

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    window.dispatchEvent(new Event(NOTIF_EVENT));
  } catch {
    // quota — silent
  }
}

export function dismissNotification(id: string): void {
  const set = loadDismissed();
  set.add(id);
  saveDismissed(set);
}

export function clearDismissed(): void {
  saveDismissed(new Set());
}

const SEVERITY_RANK: Record<NotifSeverity, number> = { high: 3, medium: 2, low: 1 };

export function gatherNotifications({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}): Notification[] {
  const out: Notification[] = [];
  const now = new Date();

  // 1) Anomalies on outgoing transfers in the last 7 days
  const recent = operations.filter((op) => {
    const ts = new Date(op.createdAt).getTime();
    return Number.isFinite(ts) && ts >= now.getTime() - 7 * 86_400_000;
  });
  for (const op of recent) {
    if (op.kind !== "transfer" || op.from !== account.id) continue;
    const flags = detectAnomalies(op, operations, account.id);
    for (const a of flags) {
      out.push({
        id: `anomaly:${op.id}:${a.kind}`,
        severity: a.severity,
        titleKey: `notif.anomaly.${a.kind}.title`,
        bodyKey: a.messageKey ?? `notif.anomaly.${a.kind}.body`,
        bodyVars: { ...(a.messageVars ?? {}), amount: op.amount.toFixed(2) },
        action: { labelKey: "notif.action.viewActivity", anchor: "bank-anchor-audit-unified" },
      });
    }
  }

  // 2) Budget cap breaches and warnings
  const capProgress = evaluateCaps(operations, account.id, loadBudgetCaps());
  for (const p of capProgress) {
    if (p.status === "breach") {
      out.push({
        id: `cap:${p.category}:breach:${monthStamp(now)}`,
        severity: "high",
        titleKey: "notif.cap.breach.title",
        titleVars: { category: `spending.category.${p.category}.label` },
        bodyKey: "notif.cap.breach.body",
        bodyVars: { pct: Math.round(p.ratio * 100) },
        action: { labelKey: "notif.action.viewCaps", anchor: "bank-anchor-flow" },
      });
    } else if (p.status === "warning") {
      out.push({
        id: `cap:${p.category}:warn:${monthStamp(now)}`,
        severity: "medium",
        titleKey: "notif.cap.warn.title",
        titleVars: { category: `spending.category.${p.category}.label` },
        bodyKey: "notif.cap.warn.body",
        bodyVars: { pct: Math.round(p.ratio * 100) },
        action: { labelKey: "notif.action.viewCaps", anchor: "bank-anchor-flow" },
      });
    }
  }

  // 3) Stale / expensive / duplicate subscriptions
  const subFindings = scanRecurring(loadRecurring());
  for (const f of subFindings.slice(0, 3)) {
    out.push({
      id: `sub:${f.recurring.id}:${f.flags.join(",")}`,
      severity: f.severity,
      titleKey: "notif.sub.title",
      titleVars: { label: f.recurring.label },
      bodyKey: "notif.sub.body",
      bodyVars: { flags: f.flags.join(", ") },
      action: { labelKey: "notif.action.viewSubs", anchor: "bank-anchor-recurring" },
    });
  }

  // 4) Low balance: if balance < avg weekly outflow / 2
  const weeklyOutflow =
    recent
      .filter((op) => op.kind === "transfer" && op.from === account.id)
      .reduce((s, op) => s + op.amount, 0) || 0;
  if (weeklyOutflow > 0 && account.balance < weeklyOutflow / 2) {
    out.push({
      id: `lowbal:${weekStamp(now)}`,
      severity: "medium",
      titleKey: "notif.lowbal.title",
      bodyKey: "notif.lowbal.body",
      bodyVars: {
        balance: account.balance.toFixed(2),
        weeklyOutflow: weeklyOutflow.toFixed(2),
      },
      action: { labelKey: "notif.action.topup", anchor: "bank-anchor-wallet" },
    });
  }

  // 5) Mature vault positions
  const positions = loadVault();
  for (const p of positions) {
    if (p.claimedAt) continue;
    if (isMature(p, now)) {
      out.push({
        id: `vault:mature:${p.id}`,
        severity: "high",
        titleKey: "notif.vault.matured.title",
        bodyKey: "notif.vault.matured.body",
        bodyVars: { principal: p.principal.toFixed(2), apy: (p.apy * 100).toFixed(0) },
        action: { labelKey: "notif.action.claim", anchor: "bank-anchor-vault" },
      });
    } else {
      const left = timeLeftHours(p, now);
      if (left > 0 && left <= 24) {
        out.push({
          id: `vault:soon:${p.id}:${dayStamp(now)}`,
          severity: "low",
          titleKey: "notif.vault.soon.title",
          bodyKey: "notif.vault.soon.body",
          bodyVars: { hours: left },
          action: { labelKey: "notif.action.viewVault", anchor: "bank-anchor-vault" },
        });
      }
    }
  }

  // 6) Expiring challenges (active + < 6 hours left)
  const evals = evaluateChallenges(operations, account.id, now);
  for (const e of evals) {
    if (e.status === "active" && e.hoursLeft > 0 && e.hoursLeft <= 6 && e.progress < 1) {
      out.push({
        id: `chal:expiring:${e.id}:${dayStamp(now)}`,
        severity: "low",
        titleKey: "notif.challenge.expiring.title",
        titleVars: { name: `challenge.${e.id}.name` },
        bodyKey: "notif.challenge.expiring.body",
        bodyVars: { hours: e.hoursLeft, pct: Math.round(e.progress * 100) },
        action: { labelKey: "notif.action.viewChallenges", anchor: "bank-anchor-challenges" },
      });
    }
  }

  // Dismiss filter
  const dismissed = loadDismissed();
  const filtered = out.filter((n) => !dismissed.has(n.id));

  // Sort by severity desc, then by id (stable)
  filtered.sort((a, b) => {
    const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (dr !== 0) return dr;
    return a.id.localeCompare(b.id);
  });

  return filtered;
}

function dayStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekStamp(d: Date): string {
  const x = new Date(d);
  const dow = x.getDay() || 7;
  x.setDate(x.getDate() - (dow - 1));
  return x.toISOString().slice(0, 10);
}

function monthStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
