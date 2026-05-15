"use client";

import Link from "next/link";
import OpeningRepertoire from "../OpeningRepertoire";

export default function RepertoirePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0b0414", color: "#e7d6ff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 0" }}>
        <Link
          href="/cyberchess"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#c084fc",
            textDecoration: "none",
            fontSize: 14,
            fontFamily: '"Inter", system-ui, sans-serif',
            padding: "8px 14px",
            background: "rgba(20, 10, 36, 0.7)",
            border: "1px solid rgba(168, 85, 247, 0.28)",
            borderRadius: 8,
          }}
        >
          ← Вернуться в CyberChess
        </Link>
      </div>
      <OpeningRepertoire open={true} onClose={() => {}} fullPage={true} />
    </div>
  );
}
