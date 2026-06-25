/**
 * Обобщённый advisor: любое AI-замечание → заготовка промпта для живого QCoreAI.
 *
 * Паттерн «детектор → живой разбор» (впервые на проёмах) распространён на все
 * сценарии: двойной счёт, забытый коэффициент, неверный индекс и т.д. Детектор
 * даёт точное замечание, QCoreAI объясняет на смете студента. Чистый — UI делает
 * сетевой вызов streamLLM, передав сюда notice и получив question + extraSystem.
 */

import type { AiNotice } from "../types";
import { scenarioLabel } from "./scenarioLabels";

/** Сценарии, для которых есть отдельная богатая панель — общий разбор им не нужен. */
export const SCENARIOS_WITH_DEDICATED_PANEL = new Set<string>(["missing-opening-subtraction"]);

export function hasDedicatedPanel(scenario: string): boolean {
  return SCENARIOS_WITH_DEDICATED_PANEL.has(scenario);
}

/** Заготовка для живого AI-разбора конкретного замечания. */
export function buildNoticeAIPrompt(notice: AiNotice): { question: string; extraSystem: string } {
  const sc = scenarioLabel(notice.scenario);
  const extraSystem = [
    `СРАБОТАВШЕЕ AI-ЗАМЕЧАНИЕ — объясни студенту на ЕГО смете:`,
    `- Тип ошибки: ${sc.label}${sc.short ? ` (${sc.short})` : ""}`,
    `- Что нашёл детектор: ${notice.message}`,
    notice.suggestion ? `- Рекомендация системы: ${notice.suggestion}` : "",
    notice.reference ? `- Норматив РК: ${notice.reference}` : "",
    `Объясни КРАТКО (2-4 предложения): в чём именно ошибка и как её исправить,`,
    `опираясь на снимок сметы выше и норматив РК. Не выдумывай цифр, которых нет в данных.`,
  ]
    .filter(Boolean)
    .join("\n");

  const question = `Разбери замечание «${notice.title}» на моей смете: в чём ошибка и как исправить?`;
  return { question, extraSystem };
}
