"use client";

import { useEffect, useState } from "react";
import { readCompare, toggleCompare, COMPARE_MAX, type CompareEntry } from "@/lib/build/compareList";

export function CompareToggleButton({ entry }: { entry: CompareEntry }) {
  const [selected, setSelected] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    function refresh() {
      const cur = readCompare();
      setSelected(cur.some((e) => e.id === entry.id));
      setCount(cur.length);
    }
    refresh();
    window.addEventListener("qbuild-compare-change", refresh);
    return () => {
      window.removeEventListener("qbuild-compare-change", refresh);
    };
  }, [entry.id]);

  const disabled = !selected && count >= COMPARE_MAX;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        toggleCompare(entry);
      }}
      title={
        selected
          ? "Remove from comparison"
          : disabled
            ? `Compare list full (${COMPARE_MAX} max)`
            : "Add to comparison"
      }
      aria-pressed={selected}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-40 ${
        selected
          ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {selected ? "✓ Compare" : "+ Compare"}
    </button>
  );
}
