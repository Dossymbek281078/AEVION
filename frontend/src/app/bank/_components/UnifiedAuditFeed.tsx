"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AUTOPILOT_EVENT,
  loadActions as loadAutopilotActions,
  type AutopilotAction,
} from "../_lib/autopilot";
import { FREEZE_EVENT, loadFreezeLog, type FreezeEvent } from "../_lib/freeze";
import { loadSignatures, SIGNATURE_EVENT, type SignedOperation } from "../_lib/signatures";
import type { Operation } from "../_lib/types";
import {
  buildUnifiedFeed,
  SOURCE_COLOR,
  SOURCE_LABEL,
  type AuditSource,
} from "../_lib/unifiedAudit";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

const FILTERS: Array<AuditSource | "all"> = ["all", "operation", "signature", "autopilot", "freeze"];

function formatRelative(iso: string, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t("uaudit.relative.s", { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t("uaudit.relative.m", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("uaudit.relative.h", { n: hr });
  const d = Math.floor(hr / 24);
  if (d < 30) return t("uaudit.relative.d", { n: d });
  return new Date(iso).toLocaleDateString();
}

export function UnifiedAuditFeed({
  accountId,
  operations,
  notify,
}: {
  accountId: string;
  operations: Operation[];
  notify: Notify;
}) {
  const { t } = useI18n();
  const [signatures, setSignatures] = useState<SignedOperation[]>([]);
  const [autopilotActions, setAutopilotActions] = useState<AutopilotAction[]>([]);
  const [freezeLog, setFreezeLog] = useState<FreezeEvent[]>([]);
  const [filter, setFilter] = useState<AuditSource | "all">("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setSignatures(loadSignatures());
      setAutopilotActions(loadAutopilotActions());
      setFreezeLog(loadFreezeLog());
    };
    sync();
    window.addEventListener(SIGNATURE_EVENT, sync);
    window.addEventListener(AUTOPILOT_EVENT, sync);
    window.addEventListener(FREEZE_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(SIGNATURE_EVENT, sync);
      window.removeEventListener(AUTOPILOT_EVENT, sync);
      window.removeEventListener(FREEZE_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const entries = useMemo(
    () =>
      buildUnifiedFeed({
        operations,
        signatures,
        autopilotActions,
        freezeLog,
        myAccountId: accountId,
        limit: 60,
      }),
    [operations, signatures, autopilotActions, freezeLog, accountId],
  );

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.source === filter)),
    [entries, filter],
  );

  const counts = useMemo(() => {
    const c: Record<AuditSource, number> = {
      operation: 0,
      signature: 0,
      autopilot: 0,
      freeze: 0,
    };
    for (const e of entries) c[e.source] += 1;
    return c;
  }, [entries]);

  const doExport = useCallback(() => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        accountId,
        sources: {
          operations: operations.length,
          signatures: signatures.length,
          autopilotActions: autopilotActions.length,
          freezeLog: freezeLog.length,
        },
        entries,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-unified-audit-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(t("uaudit.toast.exported", { n: entries.length }), "success");
    } catch {
      notify(t("uaudit.toast.exportFail"), "error");
    }
  }, [accountId, operations.length, signatures.length, autopilotActions.length, freezeLog.length, entries, notify, t]);

  return (
    <section
      aria-labelledby="unified-audit-heading"
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
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
              background: "linear-gradient(135deg, #0f172a, #475569)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            ☰
          </span>
          <div>
            <h2 id="unified-audit-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {t("uaudit.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {t("uaudit.subtitle")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={doExport}
          disabled={entries.length === 0}
          aria-label={t("uaudit.btn.export.aria")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,118,110,0.3)",
            background: entries.length === 0 ? "rgba(15,23,42,0.04)" : "#fff",
            color: entries.length === 0 ? "#94a3b8" : "#0f766e",
            fontSize: 12,
            fontWeight: 800,
            cursor: entries.length === 0 ? "default" : "pointer",
          }}
        >
          {t("uaudit.btn.export")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
        role="tablist"
        aria-label={t("uaudit.filter.aria")}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const label = f === "all" ? t("uaudit.filter.all") : SOURCE_LABEL[f];
          const color = f === "all" ? "#0f172a" : SOURCE_COLOR[f];
          const count = f === "all" ? entries.length : counts[f];
          return (
            <button
              key={f}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: active ? `1px solid ${color}` : "1px solid rgba(15,23,42,0.12)",
                background: active ? color : "#fff",
                color: active ? "#fff" : "#334155",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.06)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          {t("uaudit.empty")}
        </div>
      ) : (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 5 }}>
          {filtered.map((e) => (
            <li
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto auto",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                border: "1px solid rgba(15,23,42,0.06)",
                borderRadius: 10,
                background: "#fff",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: `${e.accent ?? SOURCE_COLOR[e.source]}15`,
                  color: e.accent ?? SOURCE_COLOR[e.source],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {e.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.title}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.subtitle}
                </div>
              </div>
              {e.amountAec !== undefined ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: e.amountAec < 0 ? "#dc2626" : "#059669",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {e.amountAec > 0 ? "+" : ""}
                  {e.amountAec.toFixed(2)}
                </span>
              ) : (
                <span />
              )}
              <span
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {formatRelative(e.at, t)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ fontSize: 10, color: "#64748b", marginTop: 10, lineHeight: 1.45 }}>
        {t("uaudit.footer", { filtered: filtered.length, total: entries.length })}
      </div>
    </section>
  );
}
