"use client";

import { useEffect, useState } from "react";

// PWA install prompt — detect beforeinstallprompt event и render компактную
// "📲 Install" pill. Пропадает после успешной установки.
// На iOS Safari beforeinstallprompt не fired — там пользователь сам через
// share menu добавляет на homescreen, поэтому fallback скрыт (no UI noise).

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    // Сессионная скрытость через localStorage flag
    try {
      if (localStorage.getItem("aevion_install_dismissed_v1") === "1") {
        setHidden(true);
      }
    } catch {}
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "dismissed") {
        // Не показывай повторно эту session
        try { localStorage.setItem("aevion_install_dismissed_v1", "1"); } catch {}
        setHidden(true);
      }
    } catch {/* prompt failed, just clear */}
  };

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("aevion_install_dismissed_v1", "1"); } catch {}
  };

  return (
    <div
      role="region"
      aria-label="PWA install prompt"
      style={{
        position: "fixed" as const,
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: "10px 14px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid #334155",
        boxShadow: "0 8px 24px rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center" as const,
        gap: 10,
        maxWidth: 340,
      }}
    >
      <span style={{ fontSize: 22 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 0.3 }}>
          Установить AEVION
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.3, marginTop: 2 }}>
          Offline-режим, нативный доступ к QTrade и AEV-кошельку
        </div>
      </div>
      <button
        onClick={install}
        style={{
          padding: "6px 12px",
          borderRadius: 5,
          border: "none",
          background: "linear-gradient(135deg, #22d3ee, #06b6d4)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: 0.3,
          whiteSpace: "nowrap" as const,
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Скрыть install prompt"
        style={{
          padding: "4px 7px",
          borderRadius: 4,
          border: "1px solid #475569",
          background: "transparent",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
