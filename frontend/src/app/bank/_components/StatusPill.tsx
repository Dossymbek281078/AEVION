"use client";

/**
 * StatusPill — small visual marker showing whether a panel is wired to live
 * backend, fully mocked, or a hybrid. Used by the bank surfaces so reviewers
 * can tell at a glance which numbers are real and which are placeholders.
 *
 *   <StatusPill kind="live" />
 *   <StatusPill kind="mock"    reason="Awaiting /api/qright/royalties" />
 *   <StatusPill kind="partial" reason="Banking live; QRight/Chess/Planet seeded" />
 *
 * Hover/long-press surfaces the reason via the native title attribute. Keeps
 * the visual minimal so it doesn't fight the existing component header.
 */

type Kind = "live" | "mock" | "partial";

const STYLES: Record<
  Kind,
  { bg: string; fg: string; border: string; label: string; dot: string }
> = {
  live: {
    bg: "rgba(16,185,129,0.10)",
    fg: "#065f46",
    border: "rgba(16,185,129,0.40)",
    label: "LIVE",
    dot: "#10b981",
  },
  mock: {
    bg: "rgba(234,179,8,0.12)",
    fg: "#854d0e",
    border: "rgba(234,179,8,0.45)",
    label: "MOCK",
    dot: "#eab308",
  },
  partial: {
    bg: "rgba(14,165,233,0.10)",
    fg: "#075985",
    border: "rgba(14,165,233,0.40)",
    label: "PARTIAL",
    dot: "#0ea5e9",
  },
};

export function StatusPill({
  kind,
  reason,
  size = "sm",
}: {
  kind: Kind;
  reason?: string;
  size?: "sm" | "xs";
}) {
  const s = STYLES[kind];
  const isXs = size === "xs";
  return (
    <span
      title={reason || s.label}
      aria-label={reason ? `${s.label} — ${reason}` : s.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: isXs ? "2px 7px" : "3px 9px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontSize: isXs ? 9 : 10,
        fontWeight: 800,
        letterSpacing: "0.10em",
        textTransform: "uppercase" as const,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
        cursor: reason ? "help" : "default",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: isXs ? 6 : 7,
          height: isXs ? 6 : 7,
          borderRadius: 999,
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}
