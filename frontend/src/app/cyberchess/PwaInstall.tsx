'use client';

import { useEffect, useState, useCallback } from 'react';
import { useChessNotifications } from './useChessNotifications';

/**
 * BeforeInstallPromptEvent — нестандартный, типизируем минимально.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'cc_pwa_install_dismissed';
const INSTALLED_KEY = 'cc_pwa_installed';
const NOTIFY_PROMPT_KEY = 'cc_pwa_notify_prompt_seen';
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

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
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

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function wasInstalledBefore(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return Boolean(localStorage.getItem(INSTALLED_KEY));
}

/* ============================ Styles ============================ */

const banner: React.CSSProperties = {
  position: 'fixed',
  left: 16,
  right: 16,
  bottom: 16,
  zIndex: 1000,
  maxWidth: 560,
  margin: '0 auto',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(16,185,129,0.45)',
  background:
    'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(10,14,26,0.94))',
  boxShadow: '0 10px 40px rgba(0,0,0,0.45), 0 0 30px rgba(16,185,129,0.18)',
  color: '#e2e8f0',
  fontSize: 13,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  backdropFilter: 'blur(8px)',
};

const titleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  fontWeight: 700,
  color: '#a7f3d0',
};

const bulletsList: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12.5,
  color: '#cbd5e1',
};

const bulletItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  lineHeight: 1.35,
};

const actionsRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 4,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 14px',
  borderRadius: 10,
  border: '1px solid rgba(16,185,129,0.55)',
  background: 'linear-gradient(135deg, rgba(16,185,129,0.30), rgba(5,150,105,0.30))',
  color: '#ecfdf5',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 0 22px rgba(16,185,129,0.25)',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.30)',
  background: 'transparent',
  color: '#cbd5e1',
  fontSize: 12.5,
  cursor: 'pointer',
};

const dismissBtn: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'transparent',
  color: '#94a3b8',
  fontSize: 12,
  cursor: 'pointer',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'rgba(2,6,23,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  backdropFilter: 'blur(4px)',
};

const modalCard: React.CSSProperties = {
  maxWidth: 520,
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(16,185,129,0.35)',
  background: 'linear-gradient(135deg, #0a0e1a, #0f172a)',
  color: '#e2e8f0',
  padding: '20px 22px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
  fontSize: 13.5,
  lineHeight: 1.5,
};

const modalH: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 16,
  fontWeight: 700,
  color: '#a7f3d0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const platformH: React.CSSProperties = {
  margin: '14px 0 6px',
  fontSize: 13,
  fontWeight: 700,
  color: '#e6fffa',
};

const stepList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: '#cbd5e1',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const notifyCard: React.CSSProperties = {
  ...banner,
  border: '1px solid rgba(59,130,246,0.45)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.45), 0 0 30px rgba(59,130,246,0.20)',
};

/* ============================ Component ============================ */

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false);

  const notifications = useChessNotifications();

  useEffect(() => {
    setMounted(true);

    if (isStandalone()) {
      setInstalled(true);
      markInstalled();
      // После установки — один раз спросим про нотификации
      try {
        const seen = localStorage.getItem(NOTIFY_PROMPT_KEY);
        if (!seen && notifications.permission === 'default') {
          setShowNotifyPrompt(true);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    if (wasInstalledBefore()) {
      // Был установлен ранее, но сейчас не в standalone — возможно открыли в браузере.
      // Не показываем баннер.
      setInstalled(true);
      return;
    }

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
      setInstalled(true);
      markInstalled();
      // Спросим про нотификации после успешной установки
      try {
        const seen = localStorage.getItem(NOTIFY_PROMPT_KEY);
        if (!seen && notifications.permission === 'default') {
          setShowNotifyPrompt(true);
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS не шлёт beforeinstallprompt — показываем подсказку.
    if (isIOS() && !isStandalone()) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstall = useCallback(async () => {
    if (!promptEvent) {
      // Нет prompt-эвента (например, iOS) — открываем help-модалку.
      setHelpOpen(true);
      return;
    }
    try {
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;
      if (result.outcome === 'accepted') {
        markInstalled();
        setInstalled(true);
        // appinstalled event придёт и тоже триггернёт notify prompt
      } else {
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

  const handleEnableNotifications = useCallback(async () => {
    const ok = await notifications.enableDaily(19);
    try {
      localStorage.setItem(NOTIFY_PROMPT_KEY, '1');
    } catch {}
    setShowNotifyPrompt(false);
    if (!ok) {
      // Если отказали — оставляем закрытым, не показываем повторно
    }
  }, [notifications]);

  const handleSkipNotifications = useCallback(() => {
    try {
      localStorage.setItem(NOTIFY_PROMPT_KEY, '1');
    } catch {}
    setShowNotifyPrompt(false);
  }, []);

  if (!mounted) return null;

  /* ====== Notify-prompt после установки ====== */
  if (installed && showNotifyPrompt) {
    return (
      <div role="dialog" aria-live="polite" style={notifyCard}>
        <div style={titleRow}>
          <span aria-hidden style={{ fontSize: 18 }}>🔔</span>
          <span style={{ color: '#bfdbfe' }}>Хочешь ежедневное напоминание?</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.45 }}>
          Раз в день в 19:00 — короткое уведомление о свежем пазле. Можно выключить в любой момент.
        </p>
        <div style={actionsRow}>
          <button
            type="button"
            onClick={handleEnableNotifications}
            style={{
              ...primaryBtn,
              border: '1px solid rgba(59,130,246,0.55)',
              background:
                'linear-gradient(135deg, rgba(59,130,246,0.30), rgba(37,99,235,0.30))',
              boxShadow: '0 0 22px rgba(59,130,246,0.25)',
              color: '#dbeafe',
            }}
          >
            <span aria-hidden>✓</span>
            <span>Включить напоминания</span>
          </button>
          <button type="button" onClick={handleSkipNotifications} style={ghostBtn}>
            Не сейчас
          </button>
        </div>
      </div>
    );
  }

  if (installed) return null;
  if (dismissed) return null;
  if (isStandalone()) return null;

  /* ====== Основной install-баннер ====== */

  const showBanner = Boolean(promptEvent) || showIosHint;

  if (!showBanner) {
    // Кнопка-чип "Установить" — компактный fallback (например пока браузер не послал beforeinstallprompt).
    return null;
  }

  const isIosVariant = !promptEvent && showIosHint;

  return (
    <>
      <div role="region" aria-label="Установка приложения" style={banner}>
        <div style={titleRow}>
          <span aria-hidden style={{ fontSize: 18 }}>♞</span>
          <span>Установи CyberChess как приложение</span>
          <button
            type="button"
            onClick={handleDismiss}
            style={dismissBtn}
            aria-label="Скрыть"
          >
            ✕
          </button>
        </div>

        <ul style={bulletsList}>
          <li style={bulletItem}>
            <span aria-hidden style={{ color: '#34d399' }}>⚡</span>
            <span>Запуск с домашнего экрана — без браузера и адресной строки</span>
          </li>
          <li style={bulletItem}>
            <span aria-hidden style={{ color: '#34d399' }}>📶</span>
            <span>Работает офлайн — играй с AI без сети</span>
          </li>
          <li style={bulletItem}>
            <span aria-hidden style={{ color: '#34d399' }}>🔔</span>
            <span>Ежедневные напоминания о пазле — держи серию</span>
          </li>
        </ul>

        <div style={actionsRow}>
          {!isIosVariant && (
            <button type="button" onClick={handleInstall} style={primaryBtn} aria-label="Установить">
              <span aria-hidden>📲</span>
              <span>Установить</span>
            </button>
          )}
          {isIosVariant && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              style={primaryBtn}
              aria-label="Как установить"
            >
              <span aria-hidden>📲</span>
              <span>Как установить на iPhone</span>
            </button>
          )}
          <button type="button" onClick={() => setHelpOpen(true)} style={ghostBtn}>
            <span aria-hidden>?</span>
            <span>Инструкция</span>
          </button>
        </div>
      </div>

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Как установить приложение"
          style={modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelpOpen(false);
          }}
        >
          <div style={modalCard}>
            <h2 style={modalH}>
              <span aria-hidden>📲</span>
              <span>Как установить CyberChess</span>
            </h2>

            <h3 style={platformH}>📱 iPhone / iPad (Safari)</h3>
            <ol style={stepList}>
              <li>Нажми кнопку <b>«Поделиться»</b> внизу 🔼</li>
              <li>Прокрути и выбери <b>«На экран „Домой“»</b> ➕</li>
              <li>Подтверди <b>«Добавить»</b> в правом верхнем углу ✅</li>
            </ol>

            <h3 style={platformH}>🤖 Android (Chrome / Edge)</h3>
            <ol style={stepList}>
              <li>Открой меню <b>⋮</b> в правом верхнем углу</li>
              <li>Выбери <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b> 📲</li>
              <li>Подтверди <b>«Установить»</b> ✅</li>
            </ol>

            <h3 style={platformH}>💻 Desktop (Chrome / Edge / Brave)</h3>
            <ol style={stepList}>
              <li>В адресной строке справа — иконка <b>⊕ «Установить»</b></li>
              <li>Либо меню <b>⋮</b> → <b>«Установить CyberChess…»</b></li>
              <li>Подтверди <b>«Установить»</b> ✅ — иконка появится на рабочем столе</li>
            </ol>

            <div style={{ ...actionsRow, marginTop: 16, justifyContent: 'flex-end' }}>
              {promptEvent && (
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen(false);
                    void handleInstall();
                  }}
                  style={primaryBtn}
                >
                  <span aria-hidden>📲</span>
                  <span>Установить сейчас</span>
                </button>
              )}
              <button type="button" onClick={() => setHelpOpen(false)} style={ghostBtn}>
                Закрыть
              </button>
            </div>

            {isAndroid() || isIOS() ? (
              <p style={{ marginTop: 14, fontSize: 11.5, color: '#94a3b8' }}>
                Совет: после установки иконка появится на домашнем экране — открывай оттуда, чтобы работало в полноэкранном режиме и офлайн.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
