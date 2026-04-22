"use client";

import { useEffect, useState } from "react";
import { useBiometric } from "../_lib/BiometricContext";
import { formatRelative } from "../_lib/format";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function BiometricCard({ email, notify }: { email: string; notify: Notify }) {
  const { supported, settings, enroll, disable, setThreshold } = useBiometric();
  const [threshold, setThresholdInput] = useState<string>("100");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (settings) setThresholdInput(String(settings.threshold));
  }, [settings]);

  if (!supported) {
    return (
      <section
        style={{
          border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          background: "rgba(15,23,42,0.02)",
        }}
        aria-labelledby="bio-heading"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(15,23,42,0.06)",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            ⛨
          </span>
          <div>
            <h3 id="bio-heading" style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "#0f172a" }}>
              Biometric protection
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              This browser/device doesn&apos;t expose Touch ID, Windows Hello or a hardware key.
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!settings) {
    return (
      <section
        style={{
          border: "1px solid rgba(13,148,136,0.25)",
          borderRadius: 16,
          padding: 18,
          marginBottom: 16,
          background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.04))",
        }}
        aria-labelledby="bio-heading"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(13,148,136,0.18)",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ⛨
            </span>
            <div style={{ minWidth: 0 }}>
              <h3 id="bio-heading" style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Add biometric protection
              </h3>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 2, lineHeight: 1.5 }}>
                Require Touch ID / Windows Hello / hardware key for transfers above the threshold.
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "grid", gap: 4, flex: "1 1 140px", minWidth: 140 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Threshold AEC</span>
            <input
              value={threshold}
              onChange={(e) => setThresholdInput(e.target.value)}
              type="number"
              min="0"
              step="1"
              placeholder="100"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.15)",
                fontSize: 13,
                background: "#fff",
              }}
            />
          </label>
          <button
            onClick={async () => {
              const n = parseFloat(threshold);
              if (!Number.isFinite(n) || n <= 0) {
                notify("Invalid threshold", "error");
                return;
              }
              setBusy(true);
              notify("Confirm with your authenticator…", "info");
              const result = await enroll(email, n);
              setBusy(false);
              if (result) notify("Biometric protection enabled", "success");
              else notify("Enrollment cancelled or failed", "error");
            }}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: busy ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: busy ? "default" : "pointer",
              whiteSpace: "nowrap" as const,
            }}
          >
            {busy ? "Waiting…" : "Enable"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        border: "1px solid rgba(5,150,105,0.25)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        background: "rgba(5,150,105,0.04)",
      }}
      aria-labelledby="bio-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(5,150,105,0.2)",
              color: "#047857",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            ⛨
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 id="bio-heading" style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "#065f46" }}>
              Biometric protection · ON
            </h3>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 2 }}>
              Transfers ≥ <strong>{settings.threshold} AEC</strong> require verification ·{" "}
              enrolled {formatRelative(settings.enrolledAt)}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm("Disable biometric protection?")) {
              disable();
              notify("Biometric protection disabled", "info");
            }
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(220,38,38,0.2)",
            background: "#fff",
            fontSize: 12,
            fontWeight: 700,
            color: "#991b1b",
            cursor: "pointer",
          }}
        >
          Disable
        </button>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "grid", gap: 4, flex: "1 1 140px", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Change threshold</span>
          <input
            value={threshold}
            onChange={(e) => setThresholdInput(e.target.value)}
            type="number"
            min="0"
            step="1"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 13,
              background: "#fff",
            }}
          />
        </label>
        <button
          onClick={() => {
            const n = parseFloat(threshold);
            if (!Number.isFinite(n) || n <= 0) {
              notify("Invalid threshold", "error");
              return;
            }
            setThreshold(n);
            notify(`Threshold set to ${n} AEC`, "success");
          }}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#334155",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Update
        </button>
      </div>
    </section>
  );
}
