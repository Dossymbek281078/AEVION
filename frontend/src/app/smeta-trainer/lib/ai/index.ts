// Главный entry point AI-советника. Прогоняет все сценарии и собирает уведомления.

import type { Lsr, AiNotice, LearningObject } from "../types";
import { detectMissingOpeningSubtraction } from "./scenarios/openings";

/** Запустить все AI-проверки на ЛСР. Возвращает уведомления, сгруппированные по серьёзности. */
export function runAiAdvisor(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];
  notices.push(...detectMissingOpeningSubtraction(lsr, object));
  // Будущие сценарии добавляются здесь:
  //   notices.push(...detectDoubleCounting(lsr, object));
  //   notices.push(...detectMissingCoefficients(lsr, object));
  //   notices.push(...detectIndexDoubleApplication(lsr, object));
  return notices;
}
