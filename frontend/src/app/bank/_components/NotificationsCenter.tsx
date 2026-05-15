"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  clearDismissed,
  dismissNotification,
  gatherNotifications,
  NOTIF_EVENT,
  type Notification,
  type NotifSeverity,
} from "../_lib/notifications";
import type { Account, Operation } from "../_lib/types";

const SEVERITY_COLOR: Record<NotifSeverity, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#0d9488",
};

const SEVERITY_ICON: Record<NotifSeverity, string> = {
  high: "!",
  medium: "▲",
  low: "i",
};

export function NotificationsCenter({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  // Re-evaluate every 30s + on storage events
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000);
    const reload = () => setTick((x) => x + 1);
    window.addEventListener(NOTIF_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NOTIF_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const notifications = useMemo(
    () => gatherNotifications({ account, operations }),
    // tick is intentionally a re-render trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account.id, account.balance, operations, tick],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const high = notifications.filter((n) => n.severity === "high").length;
  const total = notifications.length;
  const badgeColor = high > 0 ? "#dc2626" : total > 0 ? "#d97706" : "#0d9488";

  const handleAction = (n: Notification) => {
    if (n.action?.anchor && typeof document !== "undefined") {
      const el = document.getElementById(n.action.anchor);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        zIndex: 75,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("notif.bellAria", { count: total })}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "none",
          background: total > 0 ? "#0f172a" : "rgba(15,23,42,0.7)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(15,23,42,0.32)",
          fontSize: 20,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🔔
        {total > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              background: badgeColor,
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
              border: "2px solid #fff",
            }}
          >
            {total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 52,
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(70vh, 480px)",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 14,
            boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
              {t("notif.title")}
            </div>
            {total > 0 ? (
              <button
                onClick={() => {
                  for (const n of notifications) dismissNotification(n.id);
                  setTick((x) => x + 1);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t("notif.clearAll")}
              </button>
            ) : (
              <button
                onClick={() => {
                  clearDismissed();
                  setTick((x) => x + 1);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t("notif.restore")}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              {t("notif.empty")}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {notifications.map((n) => {
                const color = SEVERITY_COLOR[n.severity];
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${color}33`,
                      background: `${color}08`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: color,
                          color: "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 800,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {SEVERITY_ICON[n.severity]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>
                          {t(n.titleKey, n.titleVars
                            ? Object.fromEntries(
                                Object.entries(n.titleVars).map(([k, v]) => [
                                  k,
                                  typeof v === "string" && v.includes(".")
                                    ? t(v)
                                    : v,
                                ]),
                              )
                            : undefined)}
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 3, lineHeight: 1.4 }}>
                          {t(n.bodyKey, n.bodyVars)}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {n.action ? (
                            <button
                              onClick={() => handleAction(n)}
                              style={{
                                padding: "3px 10px",
                                borderRadius: 6,
                                border: "none",
                                background: color,
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              {t(n.action.labelKey)}
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              dismissNotification(n.id);
                              setTick((x) => x + 1);
                            }}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(15,23,42,0.12)",
                              background: "transparent",
                              color: "#64748b",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {t("notif.dismiss")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
