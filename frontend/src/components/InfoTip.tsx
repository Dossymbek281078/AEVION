"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  text: string;
  size?: number;
};

/**
 * Small accessible "?" hint shown next to technical terms.
 * Hover, focus, or tap to reveal; Esc closes; outside click closes.
 */
export function InfoTip({ label, text, size = 14 }: Props) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex", marginLeft: 4, verticalAlign: "middle" }}
    >
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label={`What is ${label}?`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: "50%",
          border: "1px solid rgba(15,23,42,0.2)",
          background: "rgba(13,148,136,0.08)",
          color: "#0d9488",
          fontSize: Math.max(9, size - 4),
          fontWeight: 800,
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          id={tipId}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            padding: "8px 12px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15,23,42,0.25)",
            width: 240,
            lineHeight: 1.5,
            zIndex: 50,
            whiteSpace: "normal",
            textAlign: "left",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontWeight: 800, color: "#5eead4", display: "block", marginBottom: 2 }}>{label}</span>
          {text}
        </span>
      )}
    </span>
  );
}
