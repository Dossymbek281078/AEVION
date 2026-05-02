"use client";

import type { CSSProperties } from "react";

const SHIMMER_KEYFRAMES = `@keyframes aevion-skeleton-shimmer {
  0% { background-position: -200% 50%; }
  100% { background-position: 200% 50%; }
}`;

export function Skeleton({
  width = "100%",
  height = 14,
  rounded = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  rounded?: number;
  style?: CSSProperties;
}) {
  return (
    <>
      <style>{SHIMMER_KEYFRAMES}</style>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width,
          height,
          borderRadius: rounded,
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.1) 50%, rgba(15,23,42,0.05) 100%)",
          backgroundSize: "200% 100%",
          animation: "aevion-skeleton-shimmer 1.6s ease-in-out infinite",
          ...style,
        }}
      />
    </>
  );
}

export function SkeletonBlock({ label, minHeight = 160 }: { label: string; minHeight?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        minHeight,
        display: "grid",
        gap: 10,
        padding: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width={40} height={40} rounded={10} />
        <div style={{ flex: 1, display: "grid", gap: 6 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="35%" height={10} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        <Skeleton height={70} rounded={12} />
        <Skeleton height={70} rounded={12} />
        <Skeleton height={70} rounded={12} />
      </div>
      <Skeleton height={40} rounded={10} />
      <span style={{ position: "absolute", left: -99999 }}>{label}</span>
    </div>
  );
}
