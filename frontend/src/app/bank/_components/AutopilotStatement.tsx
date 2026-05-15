"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { InfoTooltip } from "./InfoTooltip";
import {
  AUTOPILOT_EVENT,
  loadActions as loadAutopilotActions,
  type AutopilotAction,
} from "../_lib/autopilot";
import { FREEZE_EVENT, loadFreezeLog, type FreezeEvent } from "../_lib/freeze";
import { GOALS_EVENT, loadGoals, type SavingsGoal } from "../_lib/savings";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type Window = "7d" | "30d" | "all";

const WINDOW_LABEL_KEY: Record<Window, string> = { "7d": "ap.window.7d", "30d": "ap.window.30d", all: "ap.window.all" };

const WINDOW_MS: Record<Window, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
};

type Stats = {
  window: Window;
  movedTotalAec: number;
  movedByRule1Aec: number;
  movedByRule2Aec: number;
  actionCount: number;
  goalsCompleted: { id: string; label: string; completedAt: string }[];
  manualFreezes: number;
  anomalyFreezes: number;
  unfreezes: number;
  timestamp: string;
};

function inWindow(iso: string, windowMs: number): boolean {
  if (windowMs === Number.POSITIVE_INFINITY) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= windowMs;
}

function isRule2(action: AutopilotAction): boolean {
  return /inflow-split/i.test(action.note);
}

function computeStats(
  window: Window,
  actions: AutopilotAction[],
  freezeLog: FreezeEvent[],
  goals: SavingsGoal[],
): Stats {
  const windowMs = WINDOW_MS[window];
  const filteredActions = actions.filter((a) => inWindow(a.at, windowMs));
  const movedTotalAec = filteredActions.reduce((s, a) => s + a.amount, 0);
  const movedByRule2Aec = filteredActions
    .filter(isRule2)
    .reduce((s, a) => s + a.amount, 0);
  const movedByRule1Aec = movedTotalAec - movedByRule2Aec;

  const filteredFreezes = freezeLog.filter((f) => inWindow(f.at, windowMs));
  const manualFreezes = filteredFreezes.filter((f) => f.type === "freeze" && f.reason === "manual").length;
  const anomalyFreezes = filteredFreezes.filter((f) => f.type === "freeze" && f.reason === "anomaly").length;
  const unfreezes = filteredFreezes.filter((f) => f.type === "unfreeze").length;

  const goalsCompleted = goals
    .filter((g) => !!g.completedAt && inWindow(g.completedAt, windowMs))
    .map((g) => ({ id: g.id, label: g.label, completedAt: g.completedAt! }));

  return {
    window,
    movedTotalAec,
    movedByRule1Aec,
    movedByRule2Aec,
    actionCount: filteredActions.length,
    goalsCompleted,
    manualFreezes,
    anomalyFreezes,
    unfreezes,
    timestamp: new Date().toISOString(),
  };
}

function statementSvg(stats: Stats, accountId: string, windowLabel: string): string {
  const width = 640;
  const height = 400;
  const pad = 24;
  const title = `AEVION Autopilot · ${windowLabel}`;

  const tiles = [
    { label: "AEC moved to goals", value: stats.movedTotalAec.toFixed(2), color: "#059669" },
    { label: "Autopilot actions", value: String(stats.actionCount), color: "#0ea5e9" },
    { label: "Bursts caught", value: String(stats.anomalyFreezes), color: "#dc2626" },
    { label: "Goals completed", value: String(stats.goalsCompleted.length), color: "#d97706" },
  ];
  const tileW = (width - pad * 2 - 30) / 4;
  const tileH = 100;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${pad}" y="${pad + 14}" font-family="ui-sans-serif, system-ui" font-size="16" font-weight="900" fill="#f1f5f9">${title}</text>
  <text x="${pad}" y="${pad + 34}" font-family="ui-monospace, monospace" font-size="10" fill="#94a3b8">${accountId.slice(0, 40)}</text>
  <text x="${width - pad}" y="${pad + 14}" text-anchor="end" font-family="ui-sans-serif, system-ui" font-size="10" font-weight="700" fill="#94a3b8">${new Date(stats.timestamp).toISOString().slice(0, 10)}</text>
  ${tiles
    .map((t, i) => {
      const x = pad + i * (tileW + 10);
      const y = 80;
      return `<g>
    <rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="10" fill="${t.color}15" stroke="${t.color}55" stroke-width="1"/>
    <text x="${x + tileW / 2}" y="${y + 48}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="24" font-weight="900" fill="${t.color}">${t.value}</text>
    <text x="${x + tileW / 2}" y="${y + 78}" text-anchor="middle" font-family="ui-sans-serif, system-ui" font-size="10" font-weight="700" fill="#cbd5e1">${t.label}</text>
  </g>`;
    })
    .join("")}
  <text x="${pad}" y="220" font-family="ui-sans-serif, system-ui" font-size="11" font-weight="800" fill="#94a3b8">Rule breakdown</text>
  <rect x="${pad}" y="228" width="${width - pad * 2}" height="14" rx="7" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  ${(() => {
    const total = stats.movedTotalAec || 1;
    const r1Pct = (stats.movedByRule1Aec / total) * 100;
    const r2Pct = (stats.movedByRule2Aec / total) * 100;
    const innerW = width - pad * 2;
    return `<rect x="${pad}" y="228" width="${(innerW * r1Pct) / 100}" height="14" rx="7" fill="#0ea5e9"/>
    <rect x="${pad + (innerW * r1Pct) / 100}" y="228" width="${(innerW * r2Pct) / 100}" height="14" fill="#059669"/>`;
  })()}
  <text x="${pad}" y="260" font-family="ui-sans-serif, system-ui" font-size="10" font-weight="700" fill="#0ea5e9">● Rule #1 catch-up: ${stats.movedByRule1Aec.toFixed(2)} AEC</text>
  <text x="${pad}" y="278" font-family="ui-sans-serif, system-ui" font-size="10" font-weight="700" fill="#059669">● Rule #2 inflow-split: ${stats.movedByRule2Aec.toFixed(2)} AEC</text>
  <text x="${pad}" y="320" font-family="ui-sans-serif, system-ui" font-size="11" font-weight="800" fill="#94a3b8">Security events</text>
  <text x="${pad}" y="340" font-family="ui-sans-serif, system-ui" font-size="10" fill="#cbd5e1">Manual freezes: ${stats.manualFreezes} · Anomaly freezes: ${stats.anomalyFreezes} · Unfreezes: ${stats.unfreezes}</text>
  <text x="${pad}" y="${height - 14}" font-family="ui-sans-serif, system-ui" font-size="9" fill="#475569">AEVION Bank · generated ${new Date(stats.timestamp).toLocaleString()}</text>
</svg>`;
}

export function AutopilotStatement({
  accountId,
  notify,
}: {
  accountId: string;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [window, setWindow] = useState<Window>("30d");
  const [actions, setActions] = useState<AutopilotAction[]>([]);
  const [freezeLog, setFreezeLog] = useState<FreezeEvent[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const sync = () => {
      setActions(loadAutopilotActions());
      setFreezeLog(loadFreezeLog());
      setGoals(loadGoals());
    };
    sync();
    globalThis.window.addEventListener(AUTOPILOT_EVENT, sync);
    globalThis.window.addEventListener(FREEZE_EVENT, sync);
    globalThis.window.addEventListener(GOALS_EVENT, sync);
    globalThis.window.addEventListener("focus", sync);
    return () => {
      globalThis.window.removeEventListener(AUTOPILOT_EVENT, sync);
      globalThis.window.removeEventListener(FREEZE_EVENT, sync);
      globalThis.window.removeEventListener(GOALS_EVENT, sync);
      globalThis.window.removeEventListener("focus", sync);
    };
  }, []);

  const stats = useMemo(
    () => computeStats(window, actions, freezeLog, goals),
    [window, actions, freezeLog, goals],
  );

  const hasAny =
    stats.actionCount > 0 ||
    stats.manualFreezes + stats.anomalyFreezes > 0 ||
    stats.goalsCompleted.length > 0;

  const downloadSvg = useCallback(() => {
    try {
      const svg = statementSvg(stats, accountId, t(WINDOW_LABEL_KEY[stats.window]));
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-autopilot-statement-${stats.window}-${new Date().toISOString().slice(0, 10)}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(t("ap.toast.exported", { window: t(WINDOW_LABEL_KEY[stats.window]) }), "success");
    } catch {
      notify(t("ap.toast.exportFailed"), "error");
    }
  }, [stats, accountId, notify, t]);

  const narrative = useMemo(() => {
    if (!hasAny) return t("ap.narrative.empty");
    const parts: string[] = [];
    if (stats.movedTotalAec > 0) {
      let str = t("ap.narrative.moved", { amt: stats.movedTotalAec.toFixed(2) });
      if (stats.goalsCompleted.length > 0) {
        str += t("ap.narrative.completed", { n: stats.goalsCompleted.length, names: stats.goalsCompleted.map((g) => g.label).join(", ") });
      }
      parts.push(str);
    }
    if (stats.anomalyFreezes > 0) {
      parts.push(stats.anomalyFreezes === 1 ? t("ap.narrative.bursts.one") : t("ap.narrative.bursts.many", { n: stats.anomalyFreezes }));
    }
    if (stats.manualFreezes > 0) {
      parts.push(stats.manualFreezes === 1 ? t("ap.narrative.manual.one") : t("ap.narrative.manual.many", { n: stats.manualFreezes }));
    }
    return t("ap.narrative.lead", { window: t(WINDOW_LABEL_KEY[stats.window]).toLowerCase(), parts: parts.join(" · ") });
  }, [stats, hasAny, t]);

  return (
    <section
      aria-labelledby="statement-heading"
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, #fff 0%, rgba(5,150,105,0.02) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(135deg, #059669, #0ea5e9)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            ⚡
          </span>
          <div>
            <h2 id="statement-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {t("ap.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {t("ap.subtitle")}
            </div>
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t("ap.window.aria")}
          style={{ display: "flex", gap: 4 }}
        >
          {(["7d", "30d", "all"] as Window[]).map((w) => {
            const active = window === w;
            return (
              <button
                key={w}
                role="tab"
                aria-selected={active}
                onClick={() => setWindow(w)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: active ? "1px solid #059669" : "1px solid rgba(15,23,42,0.12)",
                  background: active ? "#059669" : "#fff",
                  color: active ? "#fff" : "#334155",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {t(WINDOW_LABEL_KEY[w])}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <StatTile
          label={
            <InfoTooltip text={t("tip.autopilotMoved")} side="top">
              <span>{t("ap.tile.moved")}</span>
            </InfoTooltip>
          }
          value={`${stats.movedTotalAec.toFixed(2)} AEC`}
          accent="#059669"
        />
        <StatTile label={t("ap.tile.actions")} value={String(stats.actionCount)} accent="#0ea5e9" />
        <StatTile label={t("ap.tile.bursts")} value={String(stats.anomalyFreezes)} accent="#dc2626" />
        <StatTile label={t("ap.tile.goals")} value={String(stats.goalsCompleted.length)} accent="#d97706" />
      </div>

      {stats.movedTotalAec > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>
            {t("ap.rule.title")}
          </div>
          <div
            role="img"
            aria-label={t("ap.rule.aria", { r1: stats.movedByRule1Aec.toFixed(2), r2: stats.movedByRule2Aec.toFixed(2) })}
            style={{
              height: 12,
              borderRadius: 999,
              background: "rgba(15,23,42,0.05)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                flex: stats.movedByRule1Aec,
                background: "#0ea5e9",
              }}
            />
            <div
              style={{
                flex: stats.movedByRule2Aec,
                background: "#059669",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "#64748b",
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            <span style={{ color: "#0ea5e9" }}>
              {t("ap.rule.r1", { amt: stats.movedByRule1Aec.toFixed(2) })}
            </span>
            <span style={{ color: "#059669" }}>
              {t("ap.rule.r2", { amt: stats.movedByRule2Aec.toFixed(2) })}
            </span>
          </div>
        </div>
      ) : null}

      {stats.goalsCompleted.length > 0 ? (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(217,119,6,0.06)",
            border: "1px solid rgba(217,119,6,0.22)",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#d97706",
              marginBottom: 4,
            }}
          >
            {t("ap.goals.title")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stats.goalsCompleted.map((g) => (
              <span
                key={g.id}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(217,119,6,0.35)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                ★ {g.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 10,
          background: "rgba(14,165,233,0.04)",
          border: "1px solid rgba(14,165,233,0.18)",
        }}
      >
        <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.45, flex: 1, minWidth: 220 }}>
          {narrative}
        </div>
        <button
          type="button"
          onClick={downloadSvg}
          disabled={!hasAny}
          aria-label={t("ap.cta.download.aria")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(5,150,105,0.35)",
            background: hasAny ? "#fff" : "rgba(15,23,42,0.04)",
            color: hasAny ? "#059669" : "#94a3b8",
            fontSize: 11,
            fontWeight: 800,
            cursor: hasAny ? "pointer" : "default",
            whiteSpace: "nowrap",
          }}
        >
          {t("ap.cta.download")}
        </button>
      </div>

      <div style={{ fontSize: 9, color: "#64748b", marginTop: 8, lineHeight: 1.45 }}>
        {t("ap.security.line", { manual: stats.manualFreezes, ms: stats.manualFreezes === 1 ? "" : "s", anomaly: stats.anomalyFreezes, as: stats.anomalyFreezes === 1 ? "" : "s", unfreezes: stats.unfreezes, us: stats.unfreezes === 1 ? "" : "s" })}
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: ReactNode;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${accent}2a`,
        background: `${accent}07`,
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1.05 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#64748b",
        }}
      >
        {label}
      </div>
    </div>
  );
}
