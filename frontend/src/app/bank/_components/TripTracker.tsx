"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  activeTrip,
  isoInputDate,
  loadTrips,
  newTrip,
  saveTrips,
  summarise,
  type Trip,
  TRIP_EVENT,
} from "../_lib/tripTracker";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function TripTracker({
  myAccountId,
  operations,
  notify,
}: {
  myAccountId: string;
  operations: Operation[];
  notify: Notify;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const reload = () => setTrips(loadTrips());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(TRIP_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(TRIP_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const active = useMemo(() => activeTrip(trips), [trips]);
  const upcoming = useMemo(
    () =>
      trips
        .filter((t) => !t.closed && new Date(t.startISO).getTime() > Date.now() && t !== active)
        .sort((a, b) => a.startISO.localeCompare(b.startISO)),
    [trips, active],
  );
  const past = useMemo(
    () =>
      trips
        .filter((t) => t.closed || (new Date(t.endISO).getTime() + 86_400_000 < Date.now() && t !== active))
        .sort((a, b) => b.endISO.localeCompare(a.endISO))
        .slice(0, 4),
    [trips, active],
  );

  const remove = (id: string) => {
    const updated = trips.filter((t) => t.id !== id);
    saveTrips(updated);
    setTrips(updated);
    notify(t("trip.toast.removed"), "info");
  };

  const closeTrip = (id: string) => {
    const updated = trips.map((t) => (t.id === id ? { ...t, closed: true } : t));
    saveTrips(updated);
    setTrips(updated);
    notify(t("trip.toast.closed"), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("trip.title")}</div>
            <InfoTooltip text={t("trip.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("trip.subtitle")}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: showForm ? "#0f172a" : "transparent",
            color: showForm ? "#fff" : "#0f172a",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {showForm ? t("trip.cancel") : `+ ${t("trip.add")}`}
        </button>
      </div>

      {showForm ? (
        <TripForm
          onCancel={() => setShowForm(false)}
          onCreate={(trip) => {
            const updated = [...trips, trip];
            saveTrips(updated);
            setTrips(updated);
            setShowForm(false);
            notify(t("trip.toast.created", { label: trip.label }), "success");
          }}
        />
      ) : null}

      {active ? (
        <ActiveTripCard
          trip={active}
          operations={operations}
          myId={myAccountId}
          code={code}
          onClose={() => closeTrip(active.id)}
          onRemove={() => remove(active.id)}
        />
      ) : null}

      {upcoming.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={sectionHeaderStyle}>{t("trip.upcoming")}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {upcoming.map((trp) => (
              <UpcomingTripRow
                key={trp.id}
                trip={trp}
                code={code}
                onRemove={() => remove(trp.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={sectionHeaderStyle}>{t("trip.past")}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {past.map((trp) => {
              const s = summarise(trp, operations, myAccountId);
              return (
                <div
                  key={trp.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(15,23,42,0.04)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#475569" }}>
                    ✈ {trp.label} · {trp.destination || "—"}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                    {formatCurrency(s.spent, code)} / {formatCurrency(trp.budgetTotal, code)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!active && upcoming.length === 0 && past.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(14,165,233,0.05)",
            borderRadius: 12,
          }}
        >
          {t("trip.empty")}
        </div>
      ) : null}
    </section>
  );
}

function ActiveTripCard({
  trip,
  operations,
  myId,
  code,
  onClose,
  onRemove,
}: {
  trip: Trip;
  operations: Operation[];
  myId: string;
  code: ReturnType<typeof useCurrency>["code"];
  onClose: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const s = useMemo(() => summarise(trip, operations, myId), [trip, operations, myId]);
  const STATUS_COLOR: Record<typeof s.status, string> = {
    ahead: "#059669",
    ok: "#0284c7",
    warn: "#d97706",
    over: "#dc2626",
  };
  const accent = STATUS_COLOR[s.status];
  const pct = trip.budgetTotal > 0 ? Math.min(100, (s.spent / trip.budgetTotal) * 100) : 0;
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${accent}10, ${accent}04)`,
        border: `1px solid ${accent}33`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
            ✈ {trip.label}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
            {trip.destination || t("trip.noDestination")} · {trip.startISO} → {trip.endISO}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: accent,
            padding: "3px 8px",
            borderRadius: 6,
            background: `${accent}1a`,
            letterSpacing: 0.5,
            textTransform: "uppercase" as const,
            whiteSpace: "nowrap" as const,
          }}
        >
          {t(`trip.status.${s.status}`)}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
        <Metric
          label={t("trip.metric.spent")}
          value={formatCurrency(s.spent, code)}
          accent={accent}
        />
        <Metric
          label={t("trip.metric.budget")}
          value={formatCurrency(trip.budgetTotal, code)}
          accent="#475569"
        />
        <Metric
          label={t("trip.metric.perDay")}
          value={formatCurrency(s.perDayBudget, code)}
          accent="#475569"
        />
        <Metric
          label={t("trip.metric.daysLeft")}
          value={String(s.daysRemaining)}
          accent="#475569"
        />
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 6,
          background: "rgba(15,23,42,0.08)",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: accent,
            transition: "width 320ms ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 10 }}>
        <span>{t("trip.opsCount", { count: s.ops.length })}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {pct.toFixed(0)}%
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={btnSecondary}
        >
          {t("trip.markDone")}
        </button>
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm(t("trip.confirmDelete"))) onRemove();
          }}
          style={btnDanger}
        >
          {t("trip.delete")}
        </button>
      </div>
    </div>
  );
}

function UpcomingTripRow({
  trip,
  code,
  onRemove,
}: {
  trip: Trip;
  code: ReturnType<typeof useCurrency>["code"];
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const days = Math.max(
    0,
    Math.ceil((new Date(trip.startISO).getTime() - Date.now()) / 86_400_000),
  );
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 10,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>
          ✈ {trip.label} · {trip.destination || "—"}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {t("trip.startsIn", { days })} · {trip.startISO}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(trip.budgetTotal, code)}
        </span>
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm(t("trip.confirmDelete"))) onRemove();
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 6px",
          }}
          aria-label={t("trip.delete")}
          title={t("trip.delete")}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function TripForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (trip: Trip) => void;
}) {
  const { t } = useI18n();
  const today = new Date();
  const weekLater = new Date();
  weekLater.setDate(today.getDate() + 7);
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(isoInputDate(today));
  const [end, setEnd] = useState(isoInputDate(weekLater));
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!label.trim()) return;
    const b = Number(budget);
    if (!Number.isFinite(b) || b <= 0) return;
    if (start > end) return;
    onCreate(
      newTrip({
        label: label.trim(),
        destination: destination.trim(),
        startISO: start,
        endISO: end,
        budgetTotal: b,
        notes: notes.trim(),
      }),
    );
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        background: "rgba(14,165,233,0.05)",
        border: "1px solid rgba(14,165,233,0.2)",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder={t("trip.field.label")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder={t("trip.field.destination")}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            {t("trip.field.start")}
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            {t("trip.field.end")}
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
        </div>
        <input
          type="number"
          min="0"
          placeholder={t("trip.field.budget")}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder={t("trip.field.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("trip.cancel")}
        </button>
        <button onClick={submit} style={btnPrimary}>
          {t("trip.create")}
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(15,23,42,0.06)" }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

const btnPrimary = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const btnSecondary = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const btnDanger = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(220,38,38,0.25)",
  background: "rgba(220,38,38,0.06)",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const sectionHeaderStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  marginBottom: 6,
} as const;

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(14,165,233,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 4,
  gap: 12,
  flexWrap: "wrap" as const,
};
