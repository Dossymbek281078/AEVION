"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Reusable info-tooltip for explaining metrics to first-time users.
// CSS-only positioning (no portal) — works because tooltips appear on focus/hover
// only and content is short enough to fit within parent flow.
export function InfoTooltip({
  children,
  text,
  width = 240,
  side = "top",
}: {
  children?: ReactNode;
  text: string;
  width?: number;
  side?: "top" | "bottom" | "right";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openSoon = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const closeSoon = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}
      onMouseEnter={openSoon}
      onMouseLeave={closeSoon}
    >
      {children}
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={text}
        onFocus={openSoon}
        onBlur={closeSoon}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "1px solid rgba(15,23,42,0.25)",
          background: "transparent",
          color: "#64748b",
          fontSize: 9,
          fontWeight: 900,
          lineHeight: 1,
          cursor: "help",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 60,
            ...(side === "top"
              ? { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
              : side === "bottom"
                ? { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
                : { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }),
            width,
            maxWidth: "calc(100vw - 24px)",
            padding: "8px 10px",
            borderRadius: 8,
            background: "#0f172a",
            color: "#f1f5f9",
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.45,
            letterSpacing: "0.01em",
            boxShadow: "0 12px 24px rgba(15,23,42,0.32)",
            pointerEvents: "none",
            whiteSpace: "normal",
            textAlign: "left",
          }}
        >
          {text}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              ...(side === "top"
                ? { top: "100%", left: "50%", transform: "translateX(-50%)" }
                : side === "bottom"
                  ? { bottom: "100%", left: "50%", transform: "translateX(-50%) rotate(180deg)" }
                  : { right: "100%", top: "50%", transform: "translateY(-50%) rotate(-90deg)" }),
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #0f172a",
            }}
          />
        </span>
      ) : null}
    </span>
  );
}
