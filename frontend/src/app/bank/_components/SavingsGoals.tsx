"use client";

import { useEffect, useRef, useState } from "react";
import { useSavings } from "../_hooks/useSavings";
import {
  forecastGoal,
  ICON_COLOR,
  ICON_LABEL,
  ICON_SYMBOL,
  type GoalForecast,
  type GoalIcon,
  type SavingsGoal,
} from "../_lib/savings";
import { btnSecondary, Field, inputStyle } from "./formPrimitives";
import { Money } from "./Money";

type Props = {
  notify: (msg: string, type?: "success" | "error" | "info") => void;
};

const ICON_CHOICES: GoalIcon[] = ["travel", "vacation", "home", "gear", "star", "heart", "coffee", "music"];

export function SavingsGoals({ notify }: Props) {
  const { goals, add, remove, contribute, reset } = useSavings();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [label, setLabel] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [icon, setIcon] = useState<GoalIcon>("star");
  const [deadline, setDeadline] = useState<string>("");
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (formOpen) firstInputRef.current?.focus();
  }, [formOpen]);

  const resetForm = () => {
    setLabel("");
    setTarget("");
    setIcon("star");
    setDeadline("");
  };

  const save = () => {
    const n = parseFloat(target);
    if (!label.trim()) {
      notify("Give the goal a name", "error");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      notify("Invalid target amount", "error");
      return;
    }
    let deadlineISO: string | null = null;
    if (deadline) {
      const d = new Date(deadline);
      if (!Number.isNaN(d.getTime())) deadlineISO = d.toISOString();
    }
    add({ label: label.trim(), icon, targetAec: n, deadlineISO });
    notify(`Goal "${label.trim()}" created`, "success");
    resetForm();
    setFormOpen(false);
  };

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="savings-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h2
          id="savings-heading"
          style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
        >
          Savings goals
          {goals.length > 0 ? (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(5,150,105,0.12)",
                color: "#047857",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {goals.filter((g) => !g.completedAt).length} active
            </span>
          ) : null}
        </h2>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          aria-controls="goal-form"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: formOpen ? "#64748b" : "linear-gradient(135deg, #059669, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {formOpen ? "Cancel" : "+ New goal"}
        </button>
      </div>

      {formOpen ? (
        <div
          id="goal-form"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(5,150,105,0.2)",
            background: "rgba(5,150,105,0.04)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label="Name">
              <input
                ref={firstInputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Vacation to Bali, MacBook Pro…"
                maxLength={60}
                style={inputStyle}
              />
            </Field>
            <Field label="Target AEC">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                type="number"
                min="0"
                step="1"
                placeholder="1000"
                style={inputStyle}
              />
            </Field>
            <Field label="Deadline (optional)">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Icon</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="radiogroup" aria-label="Icon">
              {ICON_CHOICES.map((ic) => {
                const active = icon === ic;
                return (
                  <button
                    key={ic}
                    role="radio"
                    aria-checked={active}
                    aria-label={ICON_LABEL[ic]}
                    onClick={() => setIcon(ic)}
                    title={ICON_LABEL[ic]}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: active ? `2px solid ${ICON_COLOR[ic]}` : "1px solid rgba(15,23,42,0.12)",
                      background: active ? `${ICON_COLOR[ic]}14` : "#fff",
                      color: ICON_COLOR[ic],
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {ICON_SYMBOL[ic]}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              style={btnSecondary}
            >
              Cancel
            </button>
            <button
              onClick={save}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #059669, #0d9488)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Create goal
            </button>
          </div>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          No goals yet. Save for a vacation, emergency fund, or next piece of gear.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {[...goals]
            .sort((a, b) => {
              if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
              const ad = a.deadlineISO ? new Date(a.deadlineISO).getTime() : Infinity;
              const bd = b.deadlineISO ? new Date(b.deadlineISO).getTime() : Infinity;
              return ad - bd;
            })
            .map((g) => (
              <GoalCard
                key={g.id}
                g={g}
                onAdd={(amt) => {
                  contribute(g.id, amt);
                  notify(`+${amt.toFixed(2)} AEC to "${g.label}"`, "success");
                }}
                onWithdraw={(amt) => {
                  contribute(g.id, -amt);
                  notify(`Withdrew ${amt.toFixed(2)} AEC from "${g.label}"`, "info");
                }}
                onReset={() => {
                  if (confirm(`Withdraw everything from "${g.label}"?`)) {
                    reset(g.id);
                    notify(`"${g.label}" reset`, "info");
                  }
                }}
                onDelete={() => {
                  if (confirm(`Delete goal "${g.label}"?`)) {
                    remove(g.id);
                    notify(`"${g.label}" deleted`, "info");
                  }
                }}
              />
            ))}
        </div>
      )}
    </section>
  );
}

function GoalCard({
  g,
  onAdd,
  onWithdraw,
  onReset,
  onDelete,
}: {
  g: SavingsGoal;
  onAdd: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [amt, setAmt] = useState<string>("");
  const forecast: GoalForecast = forecastGoal(g);
  const color = ICON_COLOR[g.icon];
  const completed = forecast.status === "completed";

  const statusColor =
    forecast.status === "completed"
      ? "#059669"
      : forecast.status === "onTrack"
        ? "#0f766e"
        : forecast.status === "behind"
          ? "#dc2626"
          : "#94a3b8";

  const apply = (mode: "add" | "withdraw") => {
    const n = parseFloat(amt);
    if (!Number.isFinite(n) || n <= 0) return;
    if (mode === "add") onAdd(n);
    else onWithdraw(n);
    setAmt("");
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${color}33`,
        background: completed
          ? `linear-gradient(135deg, ${color}10, rgba(5,150,105,0.06))`
          : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}18`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {ICON_SYMBOL[g.icon]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {g.label}
          </div>
          <div style={{ fontSize: 11, color: statusColor, fontWeight: 700, marginTop: 1 }}>
            {forecast.hint}
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Delete ${g.label}`}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontSize: 16,
            cursor: "pointer",
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span style={{ fontWeight: 700, color: "#0f172a" }}>
            <Money aec={g.currentAec} />
            <span style={{ color: "#94a3b8" }}> / <Money aec={g.targetAec} decimals={0} /></span>
          </span>
          <span style={{ fontWeight: 800, color }}>{forecast.progressPct.toFixed(0)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(forecast.progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${g.label}: ${forecast.progressPct.toFixed(0)}%`}
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${forecast.progressPct}%`,
              height: "100%",
              background: completed
                ? "linear-gradient(90deg, #059669, #10b981)"
                : `linear-gradient(90deg, ${color}, ${color}bb)`,
              transition: "width 400ms ease",
            }}
          />
        </div>
      </div>

      {completed ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onReset} style={{ ...btnSecondary, flex: 1 }}>
            Withdraw all
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply("add");
            }}
            style={{ ...inputStyle, flex: 1 }}
            aria-label="Amount to add or withdraw"
          />
          <button
            onClick={() => apply("add")}
            aria-label={`Add funds to ${g.label}`}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: color,
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Add
          </button>
          <button
            onClick={() => apply("withdraw")}
            aria-label={`Withdraw from ${g.label}`}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${color}`,
              background: "#fff",
              color,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}

