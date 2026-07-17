"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ToastProvider";

// Detail carried by the "aevion:plan-limit" CustomEvent that module API clients
// dispatch when the backend rejects an action with a 403 plan/tier limit.
type PlanLimitDetail = {
  error?: string;
  planKey?: string;
  limit?: number;
  used?: number;
  upgradeUrl?: string;
  [k: string]: unknown;
};

// Human-readable copy for known limit codes. Anything not spelled out here
// falls back to a generic-but-clear message, so a user is never left staring
// at a form that silently did nothing.
const MESSAGES: Record<string, (d: PlanLimitDetail) => string> = {
  plan_vacancy_limit_reached: (d) =>
    `Достигнут лимит плана${d.planKey ? ` ${d.planKey}` : ""}: вакансий ${d.used ?? d.limit ?? "—"}/${d.limit ?? "—"}. Откройте «Тарифы», чтобы разместить больше.`,
  plan_talent_search_limit: (d) =>
    `Достигнут лимит поиска по базе талантов на плане${d.planKey ? ` ${d.planKey}` : ""}. Откройте «Тарифы» для расширения.`,
};

function messageFor(d: PlanLimitDetail): string {
  const code = typeof d.error === "string" ? d.error : "";
  if (MESSAGES[code]) return MESSAGES[code](d);
  return `Достигнут лимит вашего плана${d.planKey ? ` (${d.planKey})` : ""}. Откройте «Тарифы» для апгрейда.`;
}

// Global listener: turns a swallowed 403 plan-limit into a visible toast for
// any module whose API client dispatches "aevion:plan-limit". Mounted once,
// inside ToastProvider, so every app shell is covered without per-form wiring.
export function PlanLimitToastBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    const onLimit = (e: Event) => {
      const detail = (e as CustomEvent<PlanLimitDetail>).detail || {};
      showToast(messageFor(detail), "error", 8000);
    };
    window.addEventListener("aevion:plan-limit", onLimit as EventListener);
    return () => window.removeEventListener("aevion:plan-limit", onLimit as EventListener);
  }, [showToast]);

  return null;
}
