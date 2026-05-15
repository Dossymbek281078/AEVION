"use client";

import Link from "next/link";

type Step = {
  id: string;
  label: string;
  href: string;
};

const PIPELINE_STEPS: Step[] = [
  { id: "auth", label: "Auth", href: "/auth" },
  { id: "qright", label: "QRight", href: "/qright" },
  { id: "qsign", label: "QSign", href: "/qsign" },
  { id: "qshield", label: "Shield", href: "/quantum-shield" },
  { id: "bureau", label: "Bureau", href: "/bureau" },
  { id: "planet", label: "Planet", href: "/planet" },
];

/**
 * Горизонтальный степпер IP-конвейера.
 * `current` — id текущего шага (подсвечивается).
 */
export function PipelineSteps({ current }: { current: string }) {
  const idx = PIPELINE_STEPS.findIndex((s) => s.id === current);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 20,
        overflowX: "auto",
        padding: "2px 0",
      }}
    >
      {PIPELINE_STEPS.map((step, i) => {
        const isActive = step.id === current;
        const isDone = i < idx;
        const bg = isActive
          ? "#0f172a"
          : isDone
            ? "#0d9488"
            : "rgba(15,23,42,0.06)";
        const color = isActive || isDone ? "#fff" : "#64748b";
        const borderColor = isActive
          ? "#0f172a"
          : isDone
            ? "#0d9488"
            : "rgba(15,23,42,0.15)";

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <Link
              href={step.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 999,
                background: bg,
                color,
                border: `1.5px solid ${borderColor}`,
                textDecoration: "none",
                fontWeight: isActive ? 900 : 700,
                fontSize: 12,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  background: isActive
                    ? "rgba(255,255,255,0.2)"
                    : isDone
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(15,23,42,0.08)",
                  color: isActive || isDone ? "#fff" : "#94a3b8",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : i + 1}
              </span>
              {step.label}
            </Link>
            {i < PIPELINE_STEPS.length - 1 ? (
              <div
                style={{
                  width: 20,
                  height: 2,
                  background: isDone ? "#0d9488" : "rgba(15,23,42,0.12)",
                  flexShrink: 0,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
