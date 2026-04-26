"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const click = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("ok");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 1200);
    }
  };
  return (
    <button
      onClick={click}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        border: "1px solid rgba(15,23,42,0.15)",
        background: state === "ok" ? "#d1fae5" : state === "err" ? "#fee2e2" : "#fff",
        fontSize: 11,
        fontWeight: 700,
        color: state === "ok" ? "#047857" : state === "err" ? "#b91c1c" : "#0f172a",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {state === "ok" ? "copied" : state === "err" ? "err" : label || "copy"}
    </button>
  );
}

export function ShareButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "ok">("idle");
  const click = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav?.share) {
      try {
        await nav.share({ url, title: "QSign verification" });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
      setTimeout(() => setState("idle"), 1500);
    } catch {}
  };
  return (
    <button
      onClick={click}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.15)",
        background: state === "ok" ? "#d1fae5" : "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {state === "ok" ? "Link copied" : "Share"}
    </button>
  );
}
