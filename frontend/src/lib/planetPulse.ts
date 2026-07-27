/**
 * Общий источник для сводки Planet (`/api/planet/stats`) и ленты последних
 * артефактов (`/api/planet/artifacts/recent`).
 *
 * Обе ручки на главной запрашивались дважды: сама страница и смонтированный на
 * ней виджет `PlanetPulse` ходили за одними и теми же данными независимо.
 * Замер на проде 27.07.2026 показал `planet/stats×2` и
 * `planet/artifacts/recent×2` (issue #1016).
 *
 * Дедупликация двухуровневая, как в `lib/aiSavings`: параллельные вызовы
 * разделяют один in-flight promise, последовательные в пределах TTL берут уже
 * полученное. Ошибку НЕ кэшируем — иначе одна неудача гасила бы блок до
 * перезагрузки страницы.
 *
 * Лента запрашивается с максимальным из нужных лимитов, а потребители берут
 * первые N. Два запроса за одним списком разной длины — это тот же список,
 * просто обрезанный в разных местах.
 */

import { getClientApiBase } from "./apiBase";

export type PlanetStats = {
  eligibleParticipants?: number;
  distinctVotersAllTime?: number;
  certifiedArtifactVersions?: number;
  submissions?: number;
  [k: string]: unknown;
};

export type RecentArtifact = Record<string, unknown>;

const TTL_MS = 30_000;

let statsInflight: Promise<PlanetStats | null> | null = null;
let statsCached: { at: number; value: PlanetStats } | null = null;

let recentInflight: Promise<RecentArtifact[] | null> | null = null;
let recentCached: { at: number; limit: number; value: RecentArtifact[] } | null = null;

/**
 * Сводка Planet — не больше одного сетевого запроса на TTL.
 *
 * `null` значит «не удалось получить»: вызывающий обязан показать это как
 * ошибку, а не нули. Нулевая статистика и отсутствие данных на публичной
 * странице читаются совершенно по-разному.
 */
export async function fetchPlanetStats(now: number = Date.now()): Promise<PlanetStats | null> {
  if (statsCached && now - statsCached.at < TTL_MS) return statsCached.value;
  if (statsInflight) return statsInflight;

  statsInflight = (async () => {
    try {
      const r = await fetch(`${getClientApiBase()}/api/planet/stats`);
      if (!r.ok) return null;
      const j: unknown = await r.json();
      if (!j || typeof j !== "object") return null;
      const value = j as PlanetStats;
      statsCached = { at: now, value };
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
 * Лента последних артефактов. Запрашивается один раз с наибольшим из нужных
 * лимитов; тот, кому нужно меньше, получает срез.
 *
 * Если уже полученного списка не хватает под больший лимит — идём в сеть
 * заново: отдать четыре элемента тому, кто просил пять, значит молча показать
 * неполную ленту.
 */
export async function fetchRecentArtifacts(
  limit = 5,
  now: number = Date.now(),
): Promise<RecentArtifact[] | null> {
  if (recentCached && now - recentCached.at < TTL_MS && recentCached.limit >= limit) {
    return recentCached.value.slice(0, limit);
  }
  if (recentInflight) {
    const list = await recentInflight;
    // Разделили запрос — но если он был за меньшим числом, чем нужно сейчас,
    // возвращаем что есть, а не делаем вид, что данных больше.
    return list ? list.slice(0, limit) : null;
  }

  recentInflight = (async () => {
    try {
      const r = await fetch(`${getClientApiBase()}/api/planet/artifacts/recent?limit=${limit}`);
      if (!r.ok) return null;
      const j: unknown = await r.json();
      const items = (j as { items?: unknown })?.items;
      if (!Array.isArray(items)) return null;
      recentCached = { at: now, limit, value: items as RecentArtifact[] };
      return items as RecentArtifact[];
    } catch {
      return null;
    } finally {
      recentInflight = null;
    }
  })();

  const list = await recentInflight;
  return list ? list.slice(0, limit) : null;
}

/** Только для тестов: сбросить общее состояние между случаями. */
export function __resetPlanetPulseCache(): void {
  statsInflight = null;
  statsCached = null;
  recentInflight = null;
  recentCached = null;
}
