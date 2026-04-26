"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatRelative } from "../_lib/format";
import {
  listDevices,
  localizedBrowser,
  localizedOS,
  registerCurrentDevice,
  revokeDevice,
  type Device,
} from "../_lib/devices";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

function deviceIcon(os: string): string {
  if (os === "iOS" || os === "Android") return "▢";
  if (os === "macOS" || os === "Windows" || os === "Linux") return "◧";
  return "?";
}

export function DeviceManagement({
  accountId,
  notify,
}: {
  accountId: string;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    setDevices(registerCurrentDevice(accountId));
  }, [accountId]);

  const sorted = [...devices].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
  });

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "#fff",
      }}
      aria-labelledby="devices-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2
            id="devices-heading"
            style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
          >
            {t("dev.title")}
          </h2>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: 999,
              background: "rgba(15,118,110,0.1)",
              color: "#0f766e",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {t("dev.signedIn", { n: devices.length })}
          </span>
        </div>
      </div>

      {devices.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8", padding: 12 }}>
          {t("dev.loading")}
        </div>
      ) : (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {sorted.map((d) => (
            <DeviceRow
              key={d.id}
              d={d}
              onRevoke={() => {
                if (d.current) {
                  notify(t("dev.toast.cantRevokeCurrent"), "info");
                  return;
                }
                if (
                  confirm(
                    t("dev.confirm.revoke", {
                      browser: localizedBrowser(d.browser, t),
                      os: localizedOS(d.os, t),
                    }),
                  )
                ) {
                  setDevices(revokeDevice(d.id));
                  notify(t("dev.toast.revoked"), "success");
                }
              }}
            />
          ))}
        </ul>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        {t("dev.footer")}
      </div>
    </section>
  );
}

function DeviceRow({ d, onRevoke }: { d: Device; onRevoke: () => void }) {
  const { t } = useI18n();
  const accent = d.current ? "#0f766e" : "#475569";
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: d.current ? "1px solid rgba(15,118,110,0.3)" : "1px solid rgba(15,23,42,0.08)",
        background: d.current ? "rgba(15,118,110,0.04)" : "#fff",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${accent}18`,
          color: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {deviceIcon(d.os)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
            {localizedBrowser(d.browser, t)} · {localizedOS(d.os, t)}
          </span>
          {d.current ? (
            <span
              style={{
                padding: "1px 8px",
                borderRadius: 999,
                background: "rgba(15,118,110,0.15)",
                color: "#0f766e",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}
            >
              {t("dev.row.current")}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {d.location} · {d.screen} · {d.language} · {d.timezone}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
          {t("dev.row.firstSeen", { first: formatRelative(d.firstSeenAt), last: formatRelative(d.lastActiveAt) })}
        </div>
      </div>
      <button
        onClick={onRevoke}
        disabled={d.current}
        aria-label={
          d.current
            ? t("dev.btn.revoke.aria.current")
            : t("dev.btn.revoke.aria", {
                browser: localizedBrowser(d.browser, t),
                os: localizedOS(d.os, t),
              })
        }
        title={d.current ? t("dev.btn.revoke.title.current") : undefined}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: d.current ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(220,38,38,0.25)",
          background: "#fff",
          fontSize: 12,
          fontWeight: 700,
          color: d.current ? "#94a3b8" : "#991b1b",
          cursor: d.current ? "not-allowed" : "pointer",
        }}
      >
        {t("dev.btn.revoke")}
      </button>
    </li>
  );
}
