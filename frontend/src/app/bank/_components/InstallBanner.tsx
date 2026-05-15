"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// PWA install discovery. Captures the `beforeinstallprompt` event the
// browser fires when AEVION qualifies for "Add to home screen", and
// surfaces a friendly banner. After the user installs / dismisses we
// stash a flag in localStorage so we don't pester them again.
//
// Browsers that don't fire the event (iOS Safari, Firefox desktop) just
// see nothing — graceful degradation, no UI noise.

const DISMISS_KEY = "aevion_bank_install_dismissed_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already in standalone — running as PWA already.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari exposes the legacy `navigator.standalone`.
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    let dismissed = false;
    try {
      dismissed = Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      // ignore
    }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !evt) return null;

  const install = async () => {
    if (!evt) return;
    setBusy(true);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      } else {
        try {
          localStorage.setItem(DISMISS_KEY, new Date().toISOString());
        } catch {
          // ignore
        }
        setEvt(null);
      }
    } catch {
      // ignore — browser cancelled
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setEvt(null);
  };

  return (
    <section
      role="region"
      aria-label={t("install.aria")}
      style={{
        background: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 60%, #6366f1 100%)",
        color: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 18,
        boxShadow: "0 10px 24px rgba(14,165,233,0.25)",
        display: "grid",
        gridTemplateColumns: "44px 1fr auto auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,255,255,0.20)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        ₳
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>
          {t("install.title")}
        </div>
        <div style={{ fontSize: 11, opacity: 0.92, marginTop: 2, lineHeight: 1.4 }}>
          {t("install.body")}
        </div>
      </div>
      <button
        type="button"
        onClick={install}
        disabled={busy}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "none",
          background: "#fff",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 800,
          cursor: busy ? "wait" : "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        }}
      >
        {busy ? t("install.cta.busy") : t("install.cta")}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("install.dismiss")}
        title={t("install.dismiss")}
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.30)",
          background: "transparent",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </section>
  );
}
