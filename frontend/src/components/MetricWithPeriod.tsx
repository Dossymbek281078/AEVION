"use client";

/**
 * A rate input that cannot be submitted without its period.
 * ────────────────────────────────────────────────────────
 * Platform component, not a QVenture one: any module that asks a human for
 * churn, growth, attrition or utilisation has the same trap — "4%" is excellent
 * annually and fatal monthly, and a field labelled "Monthly churn (%)" silently
 * mis-reads every deck that quotes the annual figure. Pairing the number with an
 * explicit period selector makes the unit part of the answer instead of an
 * assumption made downstream.
 */

import type React from "react";

export type RatePeriodOption = "weekly" | "monthly" | "quarterly" | "annual";
export type GrowthPeriodOption = "WoW" | "MoM" | "YoY";

const RATE_LABELS: Record<RatePeriodOption, string> = {
  weekly: "/ week",
  monthly: "/ month",
  quarterly: "/ quarter",
  annual: "/ year",
};

export interface MetricWithPeriodProps<P extends string> {
  label: string;
  value: string;
  onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  period: P;
  onPeriodChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Allowed periods, in the order they should appear. */
  periods: readonly P[];
  /** Display text per period; defaults to the period itself (e.g. "MoM"). */
  periodLabels?: Partial<Record<P, string>>;
  placeholder?: string;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  periodWidth?: number;
}

export function MetricWithPeriod<P extends string>({
  label, value, onValueChange, period, onPeriodChange, periods, periodLabels,
  placeholder, inputStyle, labelStyle, periodWidth = 104,
}: MetricWithPeriodProps<P>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          onChange={onValueChange}
          placeholder={placeholder}
          inputMode="numeric"
        />
        <select
          style={{ ...inputStyle, width: periodWidth }}
          value={period}
          onChange={onPeriodChange}
          aria-label={`${label} period`}
        >
          {periods.map((p) => (
            <option key={p} value={p}>{periodLabels?.[p] ?? p}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const RATE_PERIOD_OPTIONS: readonly RatePeriodOption[] = ["weekly", "monthly", "quarterly", "annual"];
export const GROWTH_PERIOD_OPTIONS: readonly GrowthPeriodOption[] = ["WoW", "MoM", "YoY"];
export const RATE_PERIOD_LABELS = RATE_LABELS;
