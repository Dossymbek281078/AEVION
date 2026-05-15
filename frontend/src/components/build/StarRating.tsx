"use client";

import { useState } from "react";

// Display-only star bar. Accepts a fractional value (e.g. 4.3) and
// renders 5 stars with a partial fill on the matching slot via CSS clip.
export function StarsDisplay({
  value,
  size = "md",
  showValue = false,
  reviewCount,
}: {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  reviewCount?: number | null;
}) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const px = size === "sm" ? 12 : size === "lg" ? 22 : 16;
  const text = size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-xs";

  return (
    <span className="inline-flex items-baseline gap-1.5 align-middle">
      <span className="relative inline-flex" aria-label={`${v.toFixed(1)} of 5 stars`}>
        <span className="text-slate-700" style={{ fontSize: px, lineHeight: 1 }} aria-hidden>
          ★★★★★
        </span>
        <span
          className="absolute inset-0 overflow-hidden text-amber-400"
          style={{ width: `${(v / 5) * 100}%`, fontSize: px, lineHeight: 1 }}
          aria-hidden
        >
          ★★★★★
        </span>
      </span>
      {showValue && (
        <span className={`font-semibold text-amber-200 ${text}`}>{v.toFixed(1)}</span>
      )}
      {typeof reviewCount === "number" && reviewCount > 0 && (
        <span className={`text-slate-400 ${text}`}>({reviewCount})</span>
      )}
    </span>
  );
}

// Interactive 1-5 star input. Uses radio buttons under the hood for
// keyboard accessibility — clicking a star sets value, hovering shows
// preview without committing.
export function StarsInput({
  value,
  onChange,
  size = "lg",
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "md" | "lg" | "xl";
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const px = size === "xl" ? 32 : size === "lg" ? 26 : 20;
  const display = hover ?? value;

  return (
    <div
      role="radiogroup"
      aria-label="Star rating"
      className="inline-flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display;
        return (
          <button
            type="button"
            key={star}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} stars`}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            className={`select-none transition disabled:cursor-not-allowed ${
              filled ? "text-amber-400" : "text-slate-700 hover:text-amber-300"
            }`}
            style={{ fontSize: px, lineHeight: 1 }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
