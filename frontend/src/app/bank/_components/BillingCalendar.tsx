"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  addPeriod,
  loadRecurring,
  RECURRING_EVENT,
  type Recurring,
} from "../_lib/recurring";
import { InfoTooltip } from "./InfoTooltip";

const HORIZON_DAYS = 30;

type DayBucket = {
  date: Date;
  iso: string;
  total: number;
  entries: { rec: Recurring; amount: number }[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BillingCalendar() {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [items, setItems] = useState<Recurring[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => setItems(loadRecurring());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(RECURRING_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(RECURRING_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const days = useMemo<DayBucket[]>(() => {
    const today = startOfDay(new Date());
    const buckets: DayBucket[] = [];
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      buckets.push({ date: d, iso: isoDate(d), total: 0, entries: [] });
    }
    const horizonEnd = new Date(today);
    horizonEnd.setDate(today.getDate() + HORIZON_DAYS);

    for (const r of items) {
      if (!r.active) continue;
      let cursor = new Date(r.nextRunAt);
      let safety = 0;
      while (cursor < horizonEnd && safety < 60) {
        const day = startOfDay(cursor);
        const idx = Math.floor((day.getTime() - today.getTime()) / 86_400_000);
        if (idx >= 0 && idx < HORIZON_DAYS) {
          buckets[idx].total += r.amount;
          buckets[idx].entries.push({ rec: r, amount: r.amount });
        }
        cursor = addPeriod(cursor, r.period);
        safety++;
      }
    }
    return buckets;
  }, [items]);

  const totalMonth = days.reduce((s, d) => s + d.total, 0);
  const activeDayCount = days.filter((d) => d.total > 0).length;
  const heaviest = days.reduce((m, d) => (d.total > m.total ? d : m), days[0] ?? { total: 0 } as DayBucket);

  // Layout: 5 weeks × 7 days, starting from today's day-of-week
  const startDow = days[0]?.date.getDay() ?? 0;
  const cells: (DayBucket | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (const b of days) cells.push(b);
  while (cells.length % 7 !== 0) cells.push(null);

  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("billCal.title")}</div>
            <InfoTooltip text={t("billCal.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("billCal.subtitle")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat
          label={t("billCal.statTotal")}
          value={formatCurrency(totalMonth, code)}
          accent="#0d9488"
        />
        <Stat
          label={t("billCal.statDays")}
          value={String(activeDayCount)}
          accent="#7c3aed"
        />
        <Stat
          label={t("billCal.statHeaviest")}
          value={
            heaviest && heaviest.total > 0
              ? formatCurrency(heaviest.total, code)
              : "—"
          }
          accent="#d97706"
          hint={heaviest && heaviest.total > 0 ? heaviest.iso : undefined}
        />
      </div>

      {totalMonth === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(13,148,136,0.05)",
            borderRadius: 12,
          }}
        >
          {t("billCal.empty")}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#94a3b8",
                  textAlign: "center" as const,
                  letterSpacing: 0.5,
                  textTransform: "uppercase" as const,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((c, i) => {
              if (!c) {
                return (
                  <div
                    key={`empty-${i}`}
                    style={{
                      minHeight: 56,
                      borderRadius: 8,
                      background: "rgba(15,23,42,0.02)",
                    }}
                  />
                );
              }
              const intensity = c.total > 0 ? 0.15 + 0.85 * Math.min(1, c.total / maxTotal) : 0;
              const isHovered = hovered === c.iso;
              return (
                <div
                  key={c.iso}
                  onMouseEnter={() => setHovered(c.iso)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    minHeight: 56,
                    borderRadius: 8,
                    padding: "5px 7px",
                    background:
                      c.total > 0
                        ? `rgba(13,148,136,${intensity * 0.4})`
                        : "rgba(15,23,42,0.04)",
                    border: isHovered
                      ? "1px solid #0d9488"
                      : "1px solid transparent",
                    cursor: c.total > 0 ? "pointer" : "default",
                    transition: "border-color 120ms ease",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#475569",
                      lineHeight: 1,
                    }}
                  >
                    {c.date.getDate()}
                  </div>
                  {c.total > 0 ? (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#0f766e",
                        marginTop: 4,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCurrency(c.total, code)}
                    </div>
                  ) : null}
                  {c.entries.length > 0 ? (
                    <div
                      style={{
                        fontSize: 9,
                        color: "#64748b",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {c.entries.length === 1
                        ? c.entries[0].rec.label
                        : t("billCal.itemCount", { count: c.entries.length })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {hovered ? (
            <HoveredDetail bucket={days.find((d) => d.iso === hovered)} />
          ) : null}
        </>
      )}
    </section>
  );
}

function HoveredDetail({ bucket }: { bucket: DayBucket | undefined }) {
  const { t } = useI18n();
  const { code } = useCurrency();
  if (!bucket || bucket.total === 0) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        background: "#0f172a",
        color: "#f1f5f9",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 6 }}>
        {bucket.date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        {" · "}
        {formatCurrency(bucket.total, code)}
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {bucket.entries.map((e, i) => (
          <div
            key={`${e.rec.id}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
            }}
          >
            <span>{e.rec.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(e.amount, code)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b", marginTop: 2 }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
