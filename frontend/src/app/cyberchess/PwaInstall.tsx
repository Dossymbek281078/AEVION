'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * BeforeInstallPromptEvent — нестандартный, типизируем минимально.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'cc_pwa_install_dismissed';
const DISMISS_TTL_DAYS = 30;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ маскируется под Mac — проверяем touch.
  const iPadOS =
    /Macintosh/.test(ua) &&
    typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' &&
    ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1;
  return iOSDevice || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)').matches;
  // iOS Safari
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

function isDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_TTL_DAYS;
}

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isStandalone()) return;
    if (isDismissed()) {
      setDismissed(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setPromptEvent(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS не шлёт beforeinstallprompt — показываем подсказку.
    if (isIOS() && !isStandalone()) {
      // Небольшая задержка чтобы не мигать сразу при загрузке.
      const t = window.setTimeout(() => setShowIosHint(true), 1500);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;
      if (result.outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {}
        setDismissed(true);
      }
    } finally {
      setPromptEvent(null);
    }
  }, [promptEvent]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
    setShowIosHint(false);
    setPromptEvent(null);
  }, []);

  if (!mounted || dismissed) return null;
  if (isStandalone()) return null;

  const baseBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(16,185,129,0.45)',
    background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.18))',
    color: '#a7f3d0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 0 18px rgba(16,185,129,0.18)',
  };

  const dismissBtn: React.CSSProperties = {
    marginLeft: 6,
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
  };

  if (promptEvent) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <button type="button" onClick={handleInstall} style={baseBtn} aria-label="Установить как приложение">
          <span aria-hidden>📲</span>
          <span>Установить как приложение</span>
        </button>
        <button type="button" onClick={handleDismiss} style={dismissBtn} aria-label="Скрыть">
          ✕
        </button>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid rgba(148,163,184,0.25)',
          background: 'rgba(15,23,42,0.7)',
          color: '#cbd5e1',
          fontSize: 12,
        }}
      >
        <span aria-hidden>📲</span>
        <span>
          Установить: <b>Поделиться</b> → <b>На экран «Домой»</b>
        </span>
        <button type="button" onClick={handleDismiss} style={dismissBtn} aria-label="Скрыть подсказку">
          ✕
        </button>
      </div>
    );
  }

  return null;
}
