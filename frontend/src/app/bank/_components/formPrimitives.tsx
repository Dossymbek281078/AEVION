"use client";

import type { CSSProperties, ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{label}</span>
      {children}
      {hint ? (
        <span style={{ fontSize: 10, color: "#64748b" }}>{hint}</span>
      ) : null}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  background: "#fff",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#334155",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

export const btnDanger: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(220,38,38,0.2)",
  background: "#fff",
  color: "#991b1b",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
