'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * AEVION CyberChess — notifications hook + helpers.
 *
 * Цели:
 *  - Запросить разрешение на нотификации.
 *  - Планировать ежедневное напоминание (локально, без бэкенда):
 *      храним в localStorage час напоминания и timestamp последнего показа,
 *      раз в минуту проверяем (через setInterval) и при необходимости —
 *      показываем уведомление через service worker (или прямо через Notification API).
 *  - Простой `notify(title, body, tag?)` обёртка.
 *
 * Push (Web Push API) тут НЕ реализован — для него нужен бэкенд с VAPID-ключами.
 * Архитектурно хук готов к подключению push в будущем — sw.js уже умеет
 * принимать `push` события.
 */

export const NOTIFY_ENABLED_KEY = 'cc_notifications_enabled';
export const NOTIFY_HOUR_KEY = 'cc_daily_reminder_hour';
export const NOTIFY_LAST_SHOWN_KEY = 'cc_daily_reminder_last_shown'; // yyyy-mm-dd

const DAILY_TITLE = 'CyberChess: ежедневная задача';
const DAILY_BODY = 'Загляни на 5 минут — реши сегодняшний пазл и держи серию.';
const DAILY_TAG = 'cc-daily-reminder';
const DAILY_URL = '/cyberchess/daily';

export type NotifyPermission = NotificationPermission | 'unsupported';

/**
 * Безопасно достаёт текущее состояние разрешения.
 */
export function getPermission(): NotifyPermission {
  if (typeof window === 'undefined') return 'unsupported';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * Запросить разрешение. Возвращает текущее значение даже если пользователь не дал.
 */
export async function requestPermission(): Promise<NotifyPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

/**
 * Показать уведомление. Использует SW если доступен (для notificationclick → focus url),
 * иначе fallback на прямой `new Notification(...)`.
 */
export async function notify(
  title: string,
  body: string,
  tag?: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body,
    tag,
    badge: '/icons/cyberchess.svg',
    icon: '/icons/cyberchess.svg',
    data: data ?? { url: DAILY_URL },
    // requireInteraction оставляем false, чтобы не быть навязчивыми.
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/cyberchess');
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    // Fallback
    // eslint-disable-next-line no-new
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Включён ли ежедневный напоминатель в localStorage.
 */
export function isReminderEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(NOTIFY_ENABLED_KEY) === '1';
}

/**
 * Текущий выбранный час напоминания (0..23). По умолчанию 19.
 */
export function getReminderHour(): number {
  if (typeof localStorage === 'undefined') return 19;
  const raw = localStorage.getItem(NOTIFY_HOUR_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 23) return 19;
  return Math.floor(n);
}

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Проверка: пора ли показать ежедневное напоминание сейчас?
 * Логика: если текущий час >= reminderHour И ещё не показывали сегодня — показываем.
 */
async function checkAndFireDaily(): Promise<void> {
  if (!isReminderEnabled()) return;
  if (getPermission() !== 'granted') return;

  const hour = getReminderHour();
  const now = new Date();
  if (now.getHours() < hour) return;

  const last = localStorage.getItem(NOTIFY_LAST_SHOWN_KEY);
  const today = todayKey(now);
  if (last === today) return;

  const ok = await notify(DAILY_TITLE, DAILY_BODY, DAILY_TAG, { url: DAILY_URL });
  if (ok) {
    try {
      localStorage.setItem(NOTIFY_LAST_SHOWN_KEY, today);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Запланировать ежедневное напоминание на указанный час (0..23).
 * Включает фоновую проверку (раз в минуту) в текущей вкладке.
 * Возвращает функцию-отписчик.
 */
export function scheduleDailyReminder(hour: number): () => void {
  if (typeof window === 'undefined') return () => {};
  const safeHour = Math.max(0, Math.min(23, Math.floor(hour)));
  try {
    localStorage.setItem(NOTIFY_ENABLED_KEY, '1');
    localStorage.setItem(NOTIFY_HOUR_KEY, String(safeHour));
  } catch {
    /* ignore */
  }

  // Сразу проверим — вдруг уже время.
  void checkAndFireDaily();

  const id = window.setInterval(() => {
    void checkAndFireDaily();
  }, 60 * 1000);

  return () => window.clearInterval(id);
}

/**
 * Отключить ежедневное напоминание.
 */
export function cancelDailyReminder(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NOTIFY_ENABLED_KEY, '0');
  } catch {
    /* ignore */
  }
}

/**
 * React-хук. Возвращает state + методы для UI.
 */
export interface UseChessNotificationsResult {
  permission: NotifyPermission;
  enabled: boolean;
  hour: number;
  supported: boolean;
  requestPermission: () => Promise<NotifyPermission>;
  enableDaily: (hour?: number) => Promise<boolean>;
  disableDaily: () => void;
  setHour: (hour: number) => void;
  testNotify: () => Promise<boolean>;
}

export function useChessNotifications(): UseChessNotificationsResult {
  const [permission, setPermission] = useState<NotifyPermission>('unsupported');
  const [enabled, setEnabled] = useState(false);
  const [hour, setHourState] = useState<number>(19);

  // Инициализация после mount (избегаем SSR-несовпадений).
  useEffect(() => {
    setPermission(getPermission());
    setEnabled(isReminderEnabled());
    setHourState(getReminderHour());
  }, []);

  // Фоновая проверка: если включено — крутим setInterval.
  useEffect(() => {
    if (!enabled) return;
    if (permission !== 'granted') return;
    const cancel = scheduleDailyReminder(hour);
    return cancel;
  }, [enabled, hour, permission]);

  const handleRequest = useCallback(async () => {
    const res = await requestPermission();
    setPermission(res);
    return res;
  }, []);

  const enableDaily = useCallback(
    async (h?: number): Promise<boolean> => {
      const targetHour = typeof h === 'number' ? h : hour;
      let perm = permission;
      if (perm !== 'granted') {
        perm = await requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') return false;
      scheduleDailyReminder(targetHour);
      setHourState(Math.max(0, Math.min(23, Math.floor(targetHour))));
      setEnabled(true);
      return true;
    },
    [hour, permission],
  );

  const disableDaily = useCallback(() => {
    cancelDailyReminder();
    setEnabled(false);
  }, []);

  const setHour = useCallback((h: number) => {
    const safe = Math.max(0, Math.min(23, Math.floor(h)));
    try {
      localStorage.setItem(NOTIFY_HOUR_KEY, String(safe));
    } catch {
      /* ignore */
    }
    setHourState(safe);
  }, []);

  const testNotify = useCallback(async () => {
    return notify(
      'CyberChess',
      'Проверка уведомлений работает!',
      'cc-test',
      { url: '/cyberchess' },
    );
  }, []);

  return {
    permission,
    enabled,
    hour,
    supported: permission !== 'unsupported',
    requestPermission: handleRequest,
    enableDaily,
    disableDaily,
    setHour,
    testNotify,
  };
}

export default useChessNotifications;
