// Shared "how long until we hit this goal at the current pace" helper.
// Extracted out of revenue/page.tsx so any other dashboard (e.g. /investor)
// can reuse it without copy-pasting — and, critically, without copy-pasting
// the missing sanity cap: at a near-zero growth rate, (target-current)/perDay
// produces numbers like "~4,026,810 days", which is technically correct but
// reads as broken on a dashboard. Cap it instead of printing it.
export interface GoalPace {
  change?: { grossUsd: number };
  windowDays: number;
  points: number;
}

const TOO_FAR_DAYS = 3650; // 10 years — beyond this, show "слишком медленный темп" instead of a number.

export function etaLabel(target: number, current: number, pace: GoalPace | null): string | null {
  if (current >= target) return "🎉 цель достигнута";
  if (!pace?.change || pace.points < 2) return null;
  const perDay = pace.change.grossUsd / pace.windowDays;
  if (perDay <= 0) return "нет роста за 30 дней";
  const days = Math.ceil((target - current) / perDay);
  if (days > TOO_FAR_DAYS) return "текущего темпа надолго не хватит — >10 лет";
  return `в темпе — ~${days.toLocaleString("en-US")} дн.`;
}
