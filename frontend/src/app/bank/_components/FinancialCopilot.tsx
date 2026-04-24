"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyExecute,
  AUTOPILOT_EVENT,
  commitState,
  DEFAULT_CONFIG,
  DEFAULT_STATE,
  evaluateAnomaly,
  evaluateTick,
  loadActions as loadAutopilotActions,
  loadConfig as loadAutopilotConfig,
  loadState as loadAutopilotState,
  saveConfig as saveAutopilotConfig,
  type AnomalyDecision,
  type AutopilotAction,
  type AutopilotConfig,
  type AutopilotState,
  type TickDecision,
} from "../_lib/autopilot";
import { useBiometric } from "../_lib/BiometricContext";
import { CIRCLES_EVENT, loadCircles } from "../_lib/circles";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import {
  FREEZE_EVENT,
  freezeNow,
  loadFreeze,
  secondsUntilSober,
  tryUnfreeze,
  type FreezeState,
} from "../_lib/freeze";
import { GIFTS_EVENT, pendingGifts, type Gift } from "../_lib/gifts";
import { loadRecurring, type Recurring } from "../_lib/recurring";
import { forecastGoal, GOALS_EVENT, loadGoals, type SavingsGoal } from "../_lib/savings";
import { perksByTier } from "../_lib/tierPerks";
import { computeEcosystemTrustScore } from "../_lib/trust";
import { tierLabel, type TrustTier } from "../_lib/trust";

function perksAtTier(tier: TrustTier): number {
  return perksByTier(tier).length;
}
import type { Account, Operation } from "../_lib/types";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type InsightKind = "warn" | "opportunity" | "info" | "success";

type Insight = {
  id: string;
  kind: InsightKind;
  icon: string;
  title: string;
  body: string;
  priority: number;
  cta?: { label: string; run: () => void };
};

const DISMISS_KEY = "aevion_bank_copilot_dismissed_v1";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function loadDismissed(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && now - v < DISMISS_TTL_MS) cleaned[k] = v;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveDismissed(data: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const KIND_COLOR: Record<InsightKind, string> = {
  warn: "#dc2626",
  opportunity: "#7c3aed",
  info: "#0369a1",
  success: "#059669",
};

function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const prm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  el.scrollIntoView({ behavior: prm ? "auto" : "smooth", block: "start" });
}

export function FinancialCopilot({
  account,
  operations,
  notify,
}: {
  account: Account;
  operations: Operation[];
  notify: Notify;
}) {
  const { royalty, chess, ecosystem } = useEcosystemData();
  const { settings: bioSettings, guard: bioGuard } = useBiometric();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [circlesCount, setCirclesCount] = useState<number>(0);
  const [pending, setPending] = useState<Gift[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<boolean>(false);
  const [primed, setPrimed] = useState<boolean>(false);
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfig>(DEFAULT_CONFIG);
  const [autopilotActions, setAutopilotActions] = useState<AutopilotAction[]>([]);
  const [autopilotState, setAutopilotState] = useState<AutopilotState>(DEFAULT_STATE);
  const [autopilotSettingsOpen, setAutopilotSettingsOpen] = useState<boolean>(false);
  const [freezeState, setFreezeState] = useState<FreezeState | null>(null);
  const [freezeSecondsLeft, setFreezeSecondsLeft] = useState<number>(0);

  // Load + subscribe to changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setGoals(loadGoals());
      setRecurring(loadRecurring());
      setCirclesCount(loadCircles().length);
      setPending(pendingGifts());
    };
    const syncAutopilot = () => {
      setAutopilotConfig(loadAutopilotConfig());
      setAutopilotActions(loadAutopilotActions());
      setAutopilotState(loadAutopilotState());
    };
    const syncFreeze = () => setFreezeState(loadFreeze());
    sync();
    syncAutopilot();
    syncFreeze();
    setDismissed(loadDismissed());
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    window.addEventListener(GOALS_EVENT, sync);
    window.addEventListener(CIRCLES_EVENT, sync);
    window.addEventListener(GIFTS_EVENT, sync);
    window.addEventListener(AUTOPILOT_EVENT, syncAutopilot);
    window.addEventListener(FREEZE_EVENT, syncFreeze);
    // Mark "primed" after a tick so the tab can render before any highlight animations.
    const t = window.setTimeout(() => setPrimed(true), 400);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(GOALS_EVENT, sync);
      window.removeEventListener(CIRCLES_EVENT, sync);
      window.removeEventListener(GIFTS_EVENT, sync);
      window.removeEventListener(AUTOPILOT_EVENT, syncAutopilot);
      window.removeEventListener(FREEZE_EVENT, syncFreeze);
      window.clearTimeout(t);
    };
  }, []);

  // Freeze countdown — updates every second while frozen so the button label
  // reflects remaining sober time.
  useEffect(() => {
    if (!freezeState) {
      setFreezeSecondsLeft(0);
      return;
    }
    const update = () => setFreezeSecondsLeft(secondsUntilSober(freezeState));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [freezeState]);

  const doFreeze = useCallback(() => {
    if (freezeState) return;
    const ok = window.confirm(
      "Freeze wallet?\n\nAll outgoing transfers blocked for 5 minutes. Unfreeze afterwards via biometric or time expiry.",
    );
    if (!ok) return;
    freezeNow("manual");
    notify("🔒 Wallet frozen · 5 min sober window started", "info");
  }, [freezeState, notify]);

  const doUnfreeze = useCallback(async () => {
    if (!freezeState) return;
    if (freezeSecondsLeft > 0) {
      notify(`Sober window: ${freezeSecondsLeft}s left`, "info");
      return;
    }
    let biometricOk = !bioSettings;
    if (bioSettings) {
      try {
        biometricOk = await bioGuard(0);
      } catch {
        biometricOk = false;
      }
      if (!biometricOk) {
        notify("Biometric verification failed or cancelled", "error");
        return;
      }
    }
    const result = await tryUnfreeze(biometricOk);
    if (result.ok) {
      notify("Wallet unfrozen", "success");
    } else if (result.reason === "sober-window") {
      notify(`Sober window: ${result.secondsLeft ?? "?"}s left`, "info");
    } else {
      notify(`Unfreeze failed: ${result.reason}`, "error");
    }
  }, [freezeState, freezeSecondsLeft, bioSettings, bioGuard, notify]);

  // Autopilot tick — read latest state via ref to avoid re-arming the interval
  // on every goals/recurring/actions change.
  const tickStateRef = useRef({
    config: autopilotConfig,
    state: autopilotState,
    account,
    recurring,
    goals,
    actions: autopilotActions,
  });
  tickStateRef.current = {
    config: autopilotConfig,
    state: autopilotState,
    account,
    recurring,
    goals,
    actions: autopilotActions,
  };

  useEffect(() => {
    if (!autopilotConfig.enabled) return;
    if (typeof window === "undefined") return;
    const tick = () => {
      const decision = evaluateTick(tickStateRef.current);
      if (decision.status === "execute") {
        const nextActions = applyExecute(decision, tickStateRef.current.actions);
        setAutopilotActions(nextActions);
        setAutopilotState(decision.nextState);
        notify(`Autopilot · ${decision.action.note}`, "success");
      } else {
        // Still commit the observed balance so inflow detection has a baseline
        // on the next tick — without this, rule #2 never fires on the first run.
        commitState(decision.nextState);
        setAutopilotState(decision.nextState);
      }
    };
    // Initial delay so enabling doesn't fire the exact same frame.
    const initial = window.setTimeout(tick, 3000);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [autopilotConfig.enabled, notify]);

  // Anomaly watchdog — fires more often (15s) than the tick loop because its
  // job is fast detection of suspicious outgoing bursts. Separate from tick
  // so the 60s tick can focus on goal flow without conflicting cadences.
  useEffect(() => {
    if (!autopilotConfig.enabled || !autopilotConfig.anomalyWatchdog) return;
    if (typeof window === "undefined") return;
    const check = () => {
      const cfg = tickStateRef.current.config;
      const st = tickStateRef.current.state;
      const acc = tickStateRef.current.account;
      const decision = evaluateAnomaly(cfg, st, acc, operations, freezeState !== null);
      if (decision.status !== "freeze") return;
      freezeNow(decision.note, undefined, "anomaly");
      const nextState: AutopilotState = {
        ...tickStateRef.current.state,
        lastAnomalyFreezeMs: Date.now(),
      };
      commitState(nextState);
      setAutopilotState(nextState);
      notify(`🔒 Auto-freeze · ${decision.burstCount} transfers in burst`, "error");
    };
    const initial = window.setTimeout(check, 2000);
    const id = window.setInterval(check, 15_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
    // Watchdog depends on whether a freeze is already active so it doesn't
    // loop; operations is included so a just-arrived op triggers check soon.
  }, [autopilotConfig.enabled, autopilotConfig.anomalyWatchdog, freezeState, operations, notify]);

  const toggleAutopilot = useCallback(() => {
    setAutopilotConfig((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveAutopilotConfig(next);
      return next;
    });
  }, []);

  const updateAutopilotField = useCallback(
    <K extends keyof AutopilotConfig>(key: K, value: AutopilotConfig[K]) => {
      setAutopilotConfig((prev) => {
        const next = { ...prev, [key]: value };
        saveAutopilotConfig(next);
        return next;
      });
    },
    [],
  );

  const simulateTick = useCallback((): { tick: TickDecision; anomaly: AnomalyDecision } => {
    const ctx = tickStateRef.current;
    const tick = evaluateTick(ctx);
    const anomaly = evaluateAnomaly(ctx.config, ctx.state, ctx.account, operations, freezeState !== null);
    return { tick, anomaly };
  }, [operations, freezeState]);

  const trust = useMemo(
    () => computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }),
    [account, operations, royalty, chess, ecosystem],
  );

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];

    // 1) Activity burst — ≥3 ops in last 20 minutes
    const twentyMinAgo = Date.now() - 20 * 60 * 1000;
    const burst = operations.filter((op) => {
      const t = Date.parse(op.createdAt);
      return Number.isFinite(t) && t > twentyMinAgo;
    });
    if (burst.length >= 3) {
      out.push({
        id: "burst",
        kind: "warn",
        icon: "⚠",
        title: `${burst.length} operations in last 20 min`,
        body: "Unusual burst — verify each signature in the audit log.",
        priority: 9,
        cta: { label: "Open audit", run: () => scrollToId("audit-heading") },
      });
    }

    // 2) Goals behind pace
    for (const g of goals) {
      if (g.completedAt || g.currentAec >= g.targetAec) continue;
      const fc = forecastGoal(g);
      if (fc.status === "behind" && fc.daysLeft != null && fc.daysLeft > 0) {
        const perDayNeeded =
          (g.targetAec - g.currentAec - (fc.daysToReachAtRate ? (g.targetAec - g.currentAec) * 0 : 0)) /
          Math.max(1, fc.daysLeft);
        out.push({
          id: `goal-behind-${g.id}`,
          kind: "warn",
          icon: "⏱",
          title: `Goal "${g.label}" behind schedule`,
          body: `Add ~${Math.ceil(perDayNeeded)} AEC/day to hit your ${fc.daysLeft}-day deadline.`,
          priority: 8,
          cta: {
            label: "Open goals",
            run: () => {
              const el = document.querySelector<HTMLElement>('[aria-labelledby="savings-heading"], [aria-label*="Savings"]');
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
        });
      }
    }

    // 3) Recurring vs balance — 30-day outflow projection
    const thirty = Date.now() + 30 * 24 * 60 * 60 * 1000;
    let due30d = 0;
    for (const r of recurring) {
      if (!r.active) continue;
      let t = Date.parse(r.nextRunAt);
      if (!Number.isFinite(t)) continue;
      while (t <= thirty) {
        due30d += r.amount;
        // cheap step: approximate period
        const daysStep = r.period === "daily" ? 1 : r.period === "weekly" ? 7 : r.period === "biweekly" ? 14 : 30;
        t += daysStep * 24 * 60 * 60 * 1000;
      }
    }
    if (due30d > 0) {
      const shortfall = due30d - account.balance;
      if (shortfall > 0) {
        out.push({
          id: "recurring-shortfall",
          kind: "warn",
          icon: "↯",
          title: "Recurring outflow exceeds balance",
          body: `Next 30 days: ${due30d.toFixed(0)} AEC due · balance ${account.balance.toFixed(0)} AEC · short by ${shortfall.toFixed(0)}.`,
          priority: 10,
          cta: {
            label: "Jump to top-up",
            run: () => {
              const btn = document.querySelector<HTMLElement>("form[aria-label*='Top up'], form[aria-label*='topup']");
              btn?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
        });
      } else if (due30d > account.balance * 0.75) {
        out.push({
          id: "recurring-pressure",
          kind: "info",
          icon: "•",
          title: "Recurring claims >75% of balance",
          body: `${due30d.toFixed(0)} AEC locked to schedules over 30 days. Consider a buffer.`,
          priority: 5,
        });
      }
    }

    // 4) Trust tier close — two bands. Tight (≤ 5 pts) gets higher priority
    // because it's the most actionable moment. Broader band (6..12) still
    // shown as a reminder. Both surface how many perks unlock at the gate.
    if (trust.nextTier && trust.pointsToNextTier > 0) {
      const perksAhead = perksAtTier(trust.nextTier);
      const imminent = trust.pointsToNextTier <= 5;
      if (imminent || trust.pointsToNextTier <= 12) {
        out.push({
          id: `trust-near-${trust.nextTier}`,
          kind: "opportunity",
          icon: imminent ? "↑" : "↗",
          title: imminent
            ? `${trust.pointsToNextTier} pts from ${tierLabel[trust.nextTier]} — go!`
            : `${trust.pointsToNextTier} pts to ${tierLabel[trust.nextTier]} tier`,
          body: `${perksAhead} new perks unlock · ${trust.checklist[0]?.label ?? "One more action nudges your Trust Score into the next tier."}`,
          priority: imminent ? 9 : 7,
          cta: { label: "See tier unlocks", run: () => scrollToId("bank-anchor-tiers") },
        });
      }
    }

    // 5) Biometric off
    if (!bioSettings && operations.length >= 3) {
      out.push({
        id: "biometric-off",
        kind: "opportunity",
        icon: "✦",
        title: "Enable biometric guard",
        body: "3+ operations on this device. One-tap Face/Touch ID on transfers over a threshold.",
        priority: 6,
        cta: {
          label: "Set up",
          run: () => {
            const el = document.querySelector<HTMLElement>('[aria-labelledby*="biometric"]');
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
      });
    }

    // 6) Royalty income signal
    const est30 = royalty?.estimated30d ?? 0;
    if (est30 >= 1) {
      out.push({
        id: "royalty-income",
        kind: "success",
        icon: "♪",
        title: `+${est30.toFixed(2)} AEC royalty projected (30d)`,
        body: `${royalty?.works.length ?? 0} QRight work${(royalty?.works.length ?? 0) === 1 ? "" : "s"} streaming. Auto-split to goals?`,
        priority: 4,
        cta: { label: "Royalties", run: () => {
          const el = document.querySelector<HTMLElement>("[aria-labelledby*='royalty']");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        } },
      });
    }

    // 7) Idle — no operations in 3+ days
    if (operations.length > 0) {
      const newest = operations.reduce((acc, op) => {
        const t = Date.parse(op.createdAt);
        return Number.isFinite(t) && t > acc ? t : acc;
      }, 0);
      const daysIdle = (Date.now() - newest) / (24 * 60 * 60 * 1000);
      if (daysIdle >= 3 && recurring.length === 0) {
        out.push({
          id: "idle-setup-recurring",
          kind: "info",
          icon: "↻",
          title: `${Math.floor(daysIdle)}d since last activity`,
          body: "A recurring salary or savings transfer keeps Trust Score and Achievements warm.",
          priority: 3,
          cta: {
            label: "Set up",
            run: () => {
              const el = document.querySelector<HTMLElement>('[aria-labelledby*="recurring"]');
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
        });
      }
    }

    // 8) Upcoming timelock unlock — within next 24h
    const soon = 24 * 60 * 60 * 1000;
    const imminent = pending
      .map((g) => {
        const unlockMs = g.unlockAt ? Date.parse(g.unlockAt) : Number.NaN;
        return { g, unlockMs };
      })
      .filter(({ unlockMs }) => Number.isFinite(unlockMs) && unlockMs - Date.now() >= 0 && unlockMs - Date.now() <= soon)
      .sort((a, b) => a.unlockMs - b.unlockMs);
    if (imminent.length > 0) {
      const first = imminent[0];
      const hoursLeft = Math.max(1, Math.round((first.unlockMs - Date.now()) / (60 * 60 * 1000)));
      out.push({
        id: `timelock-${first.g.id}`,
        kind: "info",
        icon: "🔐",
        title: `Gift unlocks in ~${hoursLeft}h`,
        body: `${first.g.amount.toFixed(2)} AEC → ${first.g.recipientNickname}${imminent.length > 1 ? ` (+${imminent.length - 1} more soon)` : ""}. Ensure balance stays above ${first.g.amount.toFixed(0)} AEC.`,
        priority: 6,
        cta: {
          label: "Open gift",
          run: () => {
            const el = document.getElementById("gift-heading");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
      });
    }

    // 9) Network growth — 0 contacts & 3+ ops means you're sending to self? nudge
    if (circlesCount === 0 && operations.length >= 5) {
      out.push({
        id: "network-empty",
        kind: "info",
        icon: "◈",
        title: "No Circles yet",
        body: "Create a shared group to split bills, send gifts, or request payments.",
        priority: 2,
        cta: {
          label: "Circles",
          run: () => {
            const el = document.querySelector<HTMLElement>('[aria-labelledby*="circles"]');
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
      });
    }

    return out
      .filter((i) => !(i.id in dismissed))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);
  }, [operations, goals, recurring, account.balance, trust, bioSettings, royalty, circlesCount, pending, dismissed]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: Date.now() };
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    const now = Date.now();
    setDismissed((prev) => {
      const next = { ...prev };
      for (const i of insights) next[i.id] = now;
      saveDismissed(next);
      return next;
    });
    notify("Insights cleared for 24h", "info");
  }, [insights, notify]);

  // Derive a single "headline" insight for the collapsed pill.
  const headline = insights[0] ?? null;
  const warnCount = insights.filter((i) => i.kind === "warn").length;

  if (!primed) return null;

  return (
    <aside
      aria-label="Financial Copilot"
      className="aevion-bank-copilot-offset"
      style={{
        position: "fixed",
        right: 20,
        bottom: 80,
        zIndex: 55,
        width: open ? 360 : 260,
        maxWidth: "calc(100vw - 40px)",
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 18px 42px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)",
        overflow: "hidden",
        transition: "width 240ms ease",
      }}
    >
      <style>{`
        @keyframes aevion-copilot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.45); }
          50%      { box-shadow: 0 0 0 6px rgba(5,150,105,0); }
        }
      `}</style>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close Copilot" : "Open Copilot"}
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr auto",
          gap: 10,
          alignItems: "center",
          width: "100%",
          padding: "10px 14px",
          border: "none",
          background:
            warnCount > 0
              ? "linear-gradient(135deg, rgba(220,38,38,0.08), rgba(220,38,38,0.02))"
              : autopilotConfig.enabled
                ? "linear-gradient(135deg, rgba(5,150,105,0.08), rgba(14,165,233,0.05))"
                : "linear-gradient(135deg, rgba(14,165,233,0.07), rgba(124,58,237,0.05))",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: autopilotConfig.enabled
              ? "linear-gradient(135deg, #059669, #0ea5e9)"
              : "linear-gradient(135deg, #7c3aed, #0ea5e9)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 14,
            animation:
              autopilotConfig.enabled &&
              !(window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
                ? "aevion-copilot-pulse 2.2s ease-in-out infinite"
                : "none",
            position: "relative",
          }}
        >
          {freezeState ? "🔒" : autopilotConfig.enabled ? "⚡" : "✦"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", letterSpacing: "0.02em" }}>
            Copilot {autopilotConfig.enabled ? "· Autopilot" : ""}
            {insights.length > 0 ? ` · ${insights.length}` : ""}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 1,
            }}
          >
            {headline ? headline.title : "No active nudges — all quiet."}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "#64748b",
            fontWeight: 800,
            marginLeft: 4,
          }}
        >
          {open ? "▾" : "▴"}
        </span>
      </button>

      {open ? (
        <div
          style={{
            borderTop: "1px solid rgba(15,23,42,0.06)",
            maxHeight: "52vh",
            overflowY: "auto",
            padding: 8,
          }}
        >
          {freezeState ? (
            <section
              aria-label="Panic Freeze active"
              role="alert"
              style={{
                border: "1px solid rgba(220,38,38,0.35)",
                background: "linear-gradient(135deg, rgba(220,38,38,0.10), rgba(220,38,38,0.03))",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 8,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "#dc2626",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  🔒
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#991b1b" }}>
                    Wallet frozen · {freezeState.reason === "anomaly" ? "auto" : "manual"}
                  </div>
                  <div style={{ fontSize: 10, color: "#7f1d1d", marginTop: 1, lineHeight: 1.4 }}>
                    Outgoing blocked · since {formatRelativeShort(freezeState.frozenAt)} ago
                    {freezeSecondsLeft > 0
                      ? ` · sober window ${freezeSecondsLeft}s`
                      : " · sober window passed"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void doUnfreeze()}
                disabled={freezeSecondsLeft > 0}
                aria-disabled={freezeSecondsLeft > 0}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    freezeSecondsLeft > 0
                      ? "rgba(220,38,38,0.25)"
                      : "linear-gradient(135deg, #dc2626, #f87171)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: freezeSecondsLeft > 0 ? "not-allowed" : "pointer",
                }}
              >
                {freezeSecondsLeft > 0
                  ? `Unfreeze in ${freezeSecondsLeft}s`
                  : bioSettings
                    ? "Unfreeze · biometric required"
                    : "Unfreeze now"}
              </button>
            </section>
          ) : null}
          <AutopilotPanel
            config={autopilotConfig}
            actions={autopilotActions}
            settingsOpen={autopilotSettingsOpen}
            onToggle={toggleAutopilot}
            onToggleSettings={() => setAutopilotSettingsOpen((v) => !v)}
            onUpdate={updateAutopilotField}
            onSimulate={simulateTick}
          />
          {insights.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              No active nudges — Copilot is watching in the background.
              <br />
              <span style={{ fontSize: 10, color: "#94a3b8" }}>
                Add goals, recurring, or top up to see personalised signals.
              </span>
            </div>
          ) : (
            <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {insights.map((ins) => (
                <li
                  key={ins.id}
                  style={{
                    border: `1px solid ${KIND_COLOR[ins.kind]}22`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: `${KIND_COLOR[ins.kind]}05`,
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: KIND_COLOR[ins.kind],
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {ins.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#0f172a",
                        lineHeight: 1.3,
                      }}
                    >
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 3, lineHeight: 1.45 }}>
                      {ins.body}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {ins.cta ? (
                        <button
                          type="button"
                          onClick={() => {
                            ins.cta?.run();
                            setOpen(false);
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 7,
                            border: `1px solid ${KIND_COLOR[ins.kind]}44`,
                            background: "#fff",
                            color: KIND_COLOR[ins.kind],
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {ins.cta.label} →
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => dismiss(ins.id)}
                        aria-label={`Dismiss "${ins.title}"`}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 7,
                          border: "1px solid rgba(15,23,42,0.1)",
                          background: "transparent",
                          color: "#64748b",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {insights.length > 0 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 8px 4px",
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
              }}
            >
              <span>Sorted by urgency · local signals only</span>
              <button
                type="button"
                onClick={dismissAll}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#0369a1",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Dismiss all 24h
              </button>
            </div>
          ) : null}

          {!freezeState ? (
            <div
              style={{
                borderTop: "1px dashed rgba(15,23,42,0.08)",
                paddingTop: 6,
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.35 }}>
                Emergency lock · 5-min sober window + biometric unfreeze.
              </div>
              <button
                type="button"
                onClick={doFreeze}
                aria-label="Panic Freeze — lock outgoing transfers"
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "1px solid rgba(220,38,38,0.35)",
                  background: "#fff",
                  color: "#dc2626",
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                🔒 Panic Freeze
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function AutopilotPanel({
  config,
  actions,
  settingsOpen,
  onToggle,
  onToggleSettings,
  onUpdate,
  onSimulate,
}: {
  config: AutopilotConfig;
  actions: AutopilotAction[];
  settingsOpen: boolean;
  onToggle: () => void;
  onToggleSettings: () => void;
  onUpdate: <K extends keyof AutopilotConfig>(key: K, value: AutopilotConfig[K]) => void;
  onSimulate: () => { tick: TickDecision; anomaly: AnomalyDecision };
}) {
  const recent = actions.slice(0, 3);
  const last24h = actions.filter((a) => {
    const t = Date.parse(a.at);
    return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
  });
  const movedToday = last24h.reduce((s, a) => s + a.amount, 0);
  const [preview, setPreview] = useState<{ tick: TickDecision; anomaly: AnomalyDecision; at: number } | null>(null);

  const runSimulate = () => {
    const res = onSimulate();
    setPreview({ ...res, at: Date.now() });
  };

  return (
    <section
      aria-label="Autopilot"
      style={{
        border: config.enabled ? "1px solid rgba(5,150,105,0.35)" : "1px solid rgba(15,23,42,0.08)",
        background: config.enabled ? "rgba(5,150,105,0.04)" : "rgba(15,23,42,0.02)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          aria-label="Toggle Autopilot"
          onClick={onToggle}
          style={{
            width: 38,
            height: 22,
            borderRadius: 999,
            border: "none",
            background: config.enabled ? "#059669" : "rgba(15,23,42,0.18)",
            position: "relative",
            cursor: "pointer",
            transition: "background 200ms ease",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 2,
              left: config.enabled ? 18 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 180ms ease",
              boxShadow: "0 1px 3px rgba(15,23,42,0.25)",
            }}
          />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
            Autopilot ⚡ {config.enabled ? "active" : "off"}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 1, lineHeight: 1.4 }}>
            {config.enabled
              ? `Moved ${movedToday.toFixed(2)} / ${config.dailyCapAec} AEC last 24h · tick every 60s`
              : "Opt-in: I can move small amounts into goals behind schedule."}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-label="Autopilot settings"
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            color: "#334155",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {settingsOpen ? "−" : "⚙"}
        </button>
      </div>

      {settingsOpen ? (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "8px 2px 0",
            borderTop: "1px dashed rgba(15,23,42,0.08)",
          }}
        >
          <SettingRow
            label="Daily cap"
            hint="Max AEC autopilot moves in rolling 24h"
            value={config.dailyCapAec}
            unit="AEC"
            min={5}
            max={500}
            step={5}
            onChange={(v) => onUpdate("dailyCapAec", v)}
          />
          <SettingRow
            label="Per tick max"
            hint="Cap for a single move (1 per 60s)"
            value={config.perTickMaxAec}
            unit="AEC"
            min={1}
            max={50}
            step={1}
            onChange={(v) => onUpdate("perTickMaxAec", v)}
          />
          <SettingRow
            label="Safety buffer"
            hint="Keep balance ≥ 30d recurring × this ratio"
            value={config.safetyBufferRatio}
            unit="×"
            min={1}
            max={3}
            step={0.1}
            onChange={(v) => onUpdate("safetyBufferRatio", v)}
          />
          <SettingRow
            label="Deadline window"
            hint="Rule #1: only catch-up goals with ≤ this many days left"
            value={config.maxDaysLeft}
            unit="d"
            min={7}
            max={180}
            step={1}
            onChange={(v) => onUpdate("maxDaysLeft", v)}
          />
          <div
            style={{
              marginTop: 4,
              paddingTop: 6,
              borderTop: "1px dashed rgba(15,23,42,0.08)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#64748b",
              fontWeight: 800,
            }}
          >
            Rule #2 · Split on inflow
          </div>
          <SettingRow
            label="Inflow share"
            hint="% of new inflow auto-routed to the best goal. 0 = off."
            value={config.inflowSharePct}
            unit="%"
            min={0}
            max={30}
            step={1}
            onChange={(v) => onUpdate("inflowSharePct", v)}
          />
          <SettingRow
            label="Min trigger"
            hint="Only engage rule #2 on inflow deltas ≥ this AEC"
            value={config.inflowMinTriggerAec}
            unit="AEC"
            min={1}
            max={200}
            step={1}
            onChange={(v) => onUpdate("inflowMinTriggerAec", v)}
          />
          <div
            style={{
              marginTop: 4,
              paddingTop: 6,
              borderTop: "1px dashed rgba(15,23,42,0.08)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#64748b",
              fontWeight: 800,
            }}
          >
            Rule #3 · Anomaly watchdog
          </div>
          <ToggleRow
            label="Auto-freeze on burst"
            hint={`≥ ${config.anomalyBurstCount} transfers in ${config.anomalyWindowMin}min + ≥ 20% of balance → 5-min freeze`}
            checked={config.anomalyWatchdog}
            onChange={(v) => onUpdate("anomalyWatchdog", v)}
          />
          <SettingRow
            label="Burst count"
            hint="How many outgoing transfers in the window trigger watchdog"
            value={config.anomalyBurstCount}
            unit="ops"
            min={2}
            max={10}
            step={1}
            onChange={(v) => onUpdate("anomalyBurstCount", v)}
          />
          <SettingRow
            label="Burst window"
            hint="Rolling window for counting outgoing transfers"
            value={config.anomalyWindowMin}
            unit="min"
            min={5}
            max={60}
            step={1}
            onChange={(v) => onUpdate("anomalyWindowMin", v)}
          />
          <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.45, marginTop: 4 }}>
            Autopilot is deterministic: one action per 60s tick, never overdrafts the safety
            buffer, never exceeds the daily cap, never signs cross-account transfers. Rule #2
            (inflow-split) fires first when it qualifies; rule #1 (catch-up) is the fallback.
            Rule #3 (anomaly-watchdog) runs every 15s and, when enabled, auto-triggers the same
            5-min Panic Freeze — with a 10-min cooldown between consecutive auto-freezes.
            Every action lands in the audit feed below.
          </div>

          <div
            style={{
              marginTop: 4,
              paddingTop: 6,
              borderTop: "1px dashed rgba(15,23,42,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.35, flex: 1 }}>
              Dry-run · evaluate current state without mutating anything.
            </div>
            <button
              type="button"
              onClick={runSimulate}
              aria-label="Simulate next tick now"
              style={{
                padding: "5px 10px",
                borderRadius: 7,
                border: "1px solid rgba(5,150,105,0.35)",
                background: "#fff",
                color: "#059669",
                fontSize: 10,
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Simulate now
            </button>
          </div>

          {preview ? <SimulationPreview preview={preview} /> : null}
        </div>
      ) : null}

      {recent.length > 0 ? (
        <ul
          role="list"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 3,
            borderTop: "1px dashed rgba(15,23,42,0.08)",
            paddingTop: 6,
          }}
        >
          {recent.map((a) => (
            <li
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "14px 1fr auto",
                gap: 6,
                fontSize: 10,
                color: "#475569",
              }}
            >
              <span aria-hidden="true" style={{ color: "#059669", fontWeight: 900 }}>
                ⚡
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.note}
              </span>
              <span style={{ color: "#94a3b8", fontWeight: 700 }}>
                {formatRelativeShort(a.at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SimulationPreview({
  preview,
}: {
  preview: { tick: TickDecision; anomaly: AnomalyDecision; at: number };
}) {
  const tickExecutes = preview.tick.status === "execute";
  const anomalyFires = preview.anomaly.status === "freeze";
  const anyAction = tickExecutes || anomalyFires;
  const accent = anomalyFires ? "#dc2626" : tickExecutes ? "#059669" : "#64748b";
  return (
    <div
      style={{
        marginTop: 6,
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${accent}33`,
        background: `${accent}08`,
        display: "grid",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        <span>
          Preview {anyAction ? "· would act" : "· would skip"}
        </span>
        <span style={{ color: "#94a3b8", fontWeight: 700 }}>
          {new Date(preview.at).toLocaleTimeString()}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 700 }}>
        Tick:{" "}
        {preview.tick.status === "execute" ? (
          <span style={{ color: "#059669" }}>⚡ {preview.tick.action.note}</span>
        ) : (
          <span style={{ color: "#64748b", fontWeight: 600 }}>
            skip · {preview.tick.reason}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 700 }}>
        Watchdog:{" "}
        {preview.anomaly.status === "freeze" ? (
          <span style={{ color: "#dc2626" }}>
            🔒 freeze · burst {preview.anomaly.burstCount} ·{" "}
            {preview.anomaly.burstValueAec.toFixed(0)} AEC
          </span>
        ) : (
          <span style={{ color: "#64748b", fontWeight: 600 }}>
            idle · {preview.anomaly.reason}
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.4 }}>
        Simulation only — nothing was mutated. Real tick fires every 60s;
        watchdog every 15s.
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a" }}>{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${label} ${checked ? "on" : "off"}`}
          onClick={() => onChange(!checked)}
          style={{
            width: 34,
            height: 20,
            borderRadius: 999,
            border: "none",
            background: checked ? "#dc2626" : "rgba(15,23,42,0.18)",
            position: "relative",
            cursor: "pointer",
            transition: "background 160ms ease",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 2,
              left: checked ? 16 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 160ms ease",
              boxShadow: "0 1px 3px rgba(15,23,42,0.25)",
            }}
          />
        </button>
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.35 }}>{hint}</div>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ fontWeight: 800, color: "#0f172a" }}>{label}</span>
        <span style={{ fontWeight: 800, color: "#0f172a" }}>
          {value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ width: "100%" }}
      />
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.3 }}>{hint}</div>
    </div>
  );
}

function formatRelativeShort(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}
