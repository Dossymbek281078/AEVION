/**
 * Общие запросы банка: liveness бэкенда и проверка токена.
 *
 * Обе ручки независимо просят два потребителя на одной странице (issue #1035,
 * замерено на проде — `health×2` и `auth/me×2`):
 *   • `_hooks/usePreflight` через `_components/PreflightBanner`;
 *   • `_lib/api.ts` — `pingBackend()` для баннера статуса и `fetchMe()`.
 *
 * Здесь проще, чем на главной (`lib/planetData.ts`): запросы идентичные,
 * разных параметров нет — хватает дедупликации по in-flight promise и
 * короткого TTL.
 *
 * ВАЖНО про `auth/me`: это не просто трафик, а корректность. Кэш обязан быть
 * привязан к ТОКЕНУ — иначе после входа или выхода второй потребитель получил
 * бы ответ предыдущего пользователя. Смена токена = промах кэша, всегда.
 */

import { apiUrl } from "@/lib/apiBase";
import type { Me } from "./types";

/** Короткий: задача — схлопнуть одновременные вызовы на mount, а не заморозить
 *  статус. Баннер опрашивает liveness раз в 60с, и этот опрос обязан доходить. */
const HEALTH_TTL_MS = 10_000;
const ME_TTL_MS = 10_000;

let healthInflight: Promise<boolean> | null = null;
let healthCache: { at: number; value: boolean } | null = null;

export type MeResult = { ok: boolean; user: Me | null };

let meInflight: Promise<MeResult> | null = null;
let meCache: { at: number; token: string; value: MeResult } | null = null;

/**
 * Отвечает ли бэкенд вообще. 404 считается живым: ручки может не быть, а
 * сервер при этом на месте.
 */
export async function sharedPingBackend(now: number = Date.now(), force = false): Promise<boolean> {
  if (!force && healthCache && now - healthCache.at < HEALTH_TTL_MS) return healthCache.value;
  if (!force && healthInflight) return healthInflight;

  healthInflight = (async () => {
    try {
      const res = await fetch(apiUrl("/api/health"), { method: "GET", cache: "no-store" });
      const value = res.ok || res.status === 404;
      healthCache = { at: now, value };
      return value;
    } catch {
      // «Не дозвонились» — тоже ответ, и он должен быть виден сразу, а не
      // подмениться прошлым «живой». Но в кэш не кладём: сеть могла моргнуть.
      return false;
    } finally {
      healthInflight = null;
    }
  })();

  return healthInflight;
}

/**
 * Проверить токен. Без токена — `{ ok: false, user: null }` без запроса.
 *
 * `ok` отличает «токен отвергнут» от «пользователь не получен»: preflight
 * показывает именно валидность токена, а не наличие профиля.
 */
export async function sharedFetchMe(
  token: string,
  now: number = Date.now(),
  force = false,
): Promise<MeResult> {
  if (!token) return { ok: false, user: null };
  if (!force && meCache && meCache.token === token && now - meCache.at < ME_TTL_MS) {
    return meCache.value;
  }
  if (!force && meInflight && meCache?.token === token) return meInflight;

  meInflight = (async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const value: MeResult = { ok: false, user: null };
        meCache = { at: now, token, value };
        return value;
      }
      const data = await res.json().catch(() => null);
      const user =
        data && typeof data === "object" && "user" in data ? ((data as { user: Me }).user ?? null) : null;
      const value: MeResult = { ok: true, user };
      meCache = { at: now, token, value };
      return value;
    } catch {
      return { ok: false, user: null };
    } finally {
      meInflight = null;
    }
  })();

  // Пометить, какому токену принадлежит текущий in-flight, чтобы параллельный
  // вызов с ДРУГИМ токеном не получил чужой ответ.
  meCache = meCache?.token === token ? meCache : { at: 0, token, value: { ok: false, user: null } };
  return meInflight;
}

/** Только для тестов: сбросить общее состояние между случаями. */
export function __resetBankShared(): void {
  healthInflight = null;
  healthCache = null;
  meInflight = null;
  meCache = null;
}
