/**
 * Общие данные Planet для главной страницы.
 *
 * `/api/planet/stats` и `/api/planet/artifacts/recent` независимо просят и
 * `app/page.tsx`, и смонтированный внутри неё `components/PlanetPulse`.
 * Замерено на проде 27.07 (issue #1028): по два запроса каждого за загрузку.
 *
 * Со `stats` всё просто — запрос идентичный, дедупликация по in-flight
 * promise. С `recent` сложнее: потребители просят РАЗНЫЕ лимиты (5 и 4),
 * поэтому дедупликация по URL сама по себе ничего не дала бы. Берём один раз
 * максимум и режем под каждого — сервер отдаёт список, отсортированный от
 * свежего, так что первые N большего ответа равны ответу на запрос N.
 */

import { apiUrl } from "./apiBase";

export type PlanetStats = {
  eligibleParticipants?: number;
  distinctVotersAllTime?: number;
  certifiedArtifactVersions?: number;
  [k: string]: unknown;
};

export type RecentArtifact = {
  id: string;
  submissionTitle?: string;
  artifactType?: string;
  versionNo?: number;
};

/**
 * Сколько тянем на всех. Больше текущего максимума потребителей (5), чтобы
 * добавление шестого элемента куда-нибудь не вернуло второй запрос молча.
 */
const RECENT_FETCH_LIMIT = 8;
const TTL_MS = 30_000;

type Cache<T> = { at: number; value: T } | null;

let statsInflight: Promise<PlanetStats | null> | null = null;
let statsCache: Cache<PlanetStats> = null;

let recentInflight: Promise<RecentArtifact[] | null> | null = null;
let recentCache: Cache<RecentArtifact[]> = null;

/** Статистика Planet. Не больше одного запроса на TTL, сколько бы ни спросили. */
export async function fetchPlanetStats(now: number = Date.now()): Promise<PlanetStats | null> {
  if (statsCache && now - statsCache.at < TTL_MS) return statsCache.value;
  if (statsInflight) return statsInflight;

  statsInflight = (async () => {
    try {
      const r = await fetch(apiUrl("/api/planet/stats"));
      if (!r.ok) return null;
      const j: unknown = await r.json();
      if (!j || typeof j !== "object") return null;
      const value = j as PlanetStats;
      // Кэшируем только удачу: иначе один сбой погасил бы блок до перезагрузки.
      statsCache = { at: now, value };
      return value;
    } catch {
      return null;
    } finally {
      statsInflight = null;
    }
  })();

  return statsInflight;
}

/**
 * Свежие артефакты, обрезанные под `limit`.
 *
 * `null` значит «не удалось получить» — вызывающий обязан отличать это от
 * пустого списка: «пока ничего не опубликовано» и «мы не смогли спросить»
 * выглядят на главной одинаково, а значат разное.
 */
export async function fetchRecentArtifacts(
  limit: number,
  now: number = Date.now(),
): Promise<RecentArtifact[] | null> {
  const slice = (rows: RecentArtifact[] | null) => (rows ? rows.slice(0, limit) : null);

  if (recentCache && now - recentCache.at < TTL_MS) return slice(recentCache.value);
  if (recentInflight) return recentInflight.then(slice);

  recentInflight = (async () => {
    try {
      const r = await fetch(apiUrl(`/api/planet/artifacts/recent?limit=${RECENT_FETCH_LIMIT}`));
      if (!r.ok) return null;
      const j: unknown = await r.json();
      const items = (j as { items?: unknown } | null)?.items;
      if (!Array.isArray(items)) return null;
      const value = items as RecentArtifact[];
      recentCache = { at: now, value };
      return value;
    } catch {
      return null;
    } finally {
      recentInflight = null;
    }
  })();

  return recentInflight.then(slice);
}

/** Только для тестов: сбросить общее состояние между случаями. */
export function __resetPlanetCache(): void {
  statsInflight = null;
  statsCache = null;
  recentInflight = null;
  recentCache = null;
}
