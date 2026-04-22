"use client";

import { useEffect, useState } from "react";
import { formatRelative } from "../_lib/format";
import { listDevices, registerCurrentDevice, revokeDevice, type Device } from "../_lib/devices";

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
            Devices &amp; sessions
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
            {devices.length} signed in
          </span>
        </div>
      </div>

      {devices.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8", padding: 12 }}>
          Loading device list…
        </div>
      ) : (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {sorted.map((d) => (
            <DeviceRow
              key={d.id}
              d={d}
              onRevoke={() => {
                if (d.current) {
                  notify("To revoke the current device, sign out instead", "info");
                  return;
                }
                if (confirm(`Revoke ${d.browser} on ${d.os}?`)) {
                  setDevices(revokeDevice(d.id));
                  notify("Device revoked", "success");
                }
              }}
            />
          ))}
        </ul>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        Current device fingerprint is real (browser, OS, screen, language, timezone). Other entries
        seeded for demo until <code>/api/auth/sessions</code> ships server-side session tracking.
      </div>
    </section>
  );
}

function DeviceRow({ d, onRevoke }: { d: Device; onRevoke: () => void }) {
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
            {d.browser} · {d.os}
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
              Current
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {d.location} · {d.screen} · {d.language} · {d.timezone}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
          First seen {formatRelative(d.firstSeenAt)} · last active {formatRelative(d.lastActiveAt)}
        </div>
      </div>
      <button
        onClick={onRevoke}
        disabled={d.current}
        aria-label={d.current ? "Cannot revoke current device" : `Revoke ${d.browser} on ${d.os}`}
        title={d.current ? "Sign out from header to revoke this device" : undefined}
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
        Revoke
      </button>
    </li>
  );
}
