"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";

export function AppShellLanguagePill() {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 60,
        padding: 4,
        borderRadius: 10,
        background: "rgba(15,23,42,0.78)",
        backdropFilter: "blur(8px)",
        color: "#e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      <LanguageSwitcher />
    </div>
  );
}
