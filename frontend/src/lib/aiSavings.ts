/**
 * Общий счётчик экономии на смарт-роутинге (`GET /api/qcoreai/smart/savings`).
 *
 * Ручку independently дёргают несколько потребителей на одной странице:
 * виджет в шапке (`PlatformAiSavings`), сама `/pricing`, `/pitch`, `/acquire`,
 * `/studio`. Замерено на проде 27.07: на `/pricing` — 3 запроса за загрузку
 * (issue #1016). Число одно и то же для всех, поэтому и запрос должен быть
 * один.
 *
 * Дедупликация двухуровневая: параллельные вызовы разделяют один in-flight
 * promise, последовательные в пределах TTL берут уже полученное значение.
 * Ошибку НЕ кэшируем — иначе одна неудача гасила бы счётчик до перезагрузки.
 */

import { getClientApiBase } from "./apiBase";

/** Ответ `GET /api/qcoreai/smart/savings` — форма как у потребителей виджета. */
export type AiSavings = {
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
};

const TTL_MS = 30_000;

let inflight: Promise<AiSavings | null> | null = null;
let cached: { at: number; value: AiSavings | null } | null = null;

function isSavings(x: unknown): x is AiSavings {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.savedPct === "number" &&
    typeof o.savedUsd === "number" &&
    typeof o.runs === "number"
  );
}

/**
 * Вернуть счётчик, сделав не больше одного сетевого запроса на TTL.
 *
 * `null` значит «не удалось получить» — вызывающий обязан ничего не рисовать,
 * а не подставлять ноль: нулевая экономия и отсутствие данных на продающей
 * странице читаются совершенно по-разному.
 */
export async function fetchAiSavings(now: number = Date.now()): Promise<AiSavings | null> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch(`${getClientApiBase()}/api/qcoreai/smart/savings`, {
        cache: "no-store",
      });
      if (!r.ok) return null;
      const j: unknown = await r.json();
      const value = isSavings(j) ? j : null;
      // Кэшируем только удачу: иначе один 502 гасил бы счётчик на всей
      // платформе до перезагрузки страницы.
      if (value) cached = { at: now, value };
      return value;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Только для тестов: сбросить общее состояние между случаями. */
export function __resetAiSavingsCache(): void {
  inflight = null;
  cached = null;
}
