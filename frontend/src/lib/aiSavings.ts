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
  /**
   * По скольким вызовам экономия реально считалась. Может отсутствовать: поле
   * добавлено 01.10.2026, и старый сервер его не присылает — тогда охват
   * НЕИЗВЕСТЕН, и это не то же самое, что ноль.
   */
  runsCompared?: number;
};

/**
 * Ниже этого охвата доля — шум, а не свойство платформы, и показывать её
 * покупателю нельзя.
 *
 * 🔴 Порог взят не из головы. Замер прода 01.10.2026: вызовов 145, экономия
 * записана у 3, и значок в шапке КАЖДОЙ страницы сообщал «AI saved $0.23».
 * Это правда и одновременно довод ПРОТИВ нас: на странице, где мы просим $400
 * в месяц, первое денежное число — двадцать три цента. Хуже того, доля 2.05 %
 * считалась по двум разным совокупностям и расходилась с собственными полями
 * ответа в 41.7 раза.
 *
 * Тридцать — это «счётчик пережил хотя бы один рабочий день на разных
 * модулях». Число названо здесь, а не спрятано в условии, чтобы его можно было
 * оспорить замером.
 */
export const МИН_ОХВАТ_ДЛЯ_ПОКАЗА = 30;

/**
 * Можно ли показывать этот счётчик человеку.
 *
 * Три исхода, а не два (правило о сторожах): охват известен и достаточен —
 * показываем; известен и мал — молчим; НЕИЗВЕСТЕН (старый сервер без поля) —
 * тоже молчим, потому что «не знаю» не равно «можно».
 */
export function счётчикГоденДляПоказа(s: AiSavings | null): boolean {
  if (!s) return false;
  if (typeof s.runsCompared !== "number") return false;
  return s.runsCompared >= МИН_ОХВАТ_ДЛЯ_ПОКАЗА;
}

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
