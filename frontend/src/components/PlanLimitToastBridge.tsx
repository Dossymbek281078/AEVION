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
  // Plan/tier limits — lifting them means upgrading the plan.
  plan_vacancy_limit_reached: (d) =>
    `Достигнут лимит плана${d.planKey ? ` ${d.planKey}` : ""}: вакансий ${d.used ?? d.limit ?? "—"}/${d.limit ?? "—"}. Откройте «Тарифы», чтобы разместить больше.`,
  plan_talent_search_limit_reached: (d) =>
    `Исчерпан лимит поиска по базе талантов на плане${d.planKey ? ` ${d.planKey}` : ""}${d.limit ? ` (${d.used ?? "—"}/${d.limit} в месяц)` : ""}. Откройте «Тарифы» для расширения.`,
  // Hard per-account caps — NOT tied to plan tier, so no "upgrade" wording:
  // the user frees up room by removing existing items.
  portfolio_photo_limit_reached: (d) =>
    `Достигнут лимит портфолио: ${d.limit ?? 30} фото. Удалите лишние, чтобы добавить новые.`,
  bulk_template_limit_reached: (d) =>
    `Достигнут лимит шаблонов рассылки: ${d.limit ?? 30}. Удалите лишние, чтобы создать новый.`,
};

function messageFor(d: PlanLimitDetail): string {
  const code = typeof d.error === "string" ? d.error : "";
  if (MESSAGES[code]) return MESSAGES[code](d);
  // Unknown limit: only promise an upgrade for `plan_*` codes; other caps get
  // a neutral message so we never mislead the user toward the pricing page.
  if (code.startsWith("plan_")) {
    return `Достигнут лимит плана${d.planKey ? ` (${d.planKey})` : ""}. Откройте «Тарифы» для апгрейда.`;
  }
  return `Достигнут один из лимитов аккаунта. Удалите лишнее или проверьте условия плана.`;
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
