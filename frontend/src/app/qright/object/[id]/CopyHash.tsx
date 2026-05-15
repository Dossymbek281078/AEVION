"use client";

import { useState } from "react";

export function CopyHash({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        border: "1px solid rgba(15,23,42,0.15)",
        background: copied ? "#0d9488" : "#fff",
        color: copied ? "#fff" : "#0f172a",
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer",
        marginLeft: 8,
      }}
      title={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
