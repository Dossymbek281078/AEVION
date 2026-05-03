import type { Lsr, AiNotice, LearningObject } from "../types";
import { detectMissingOpeningSubtraction } from "./scenarios/openings";
import { checkDoubleCount } from "./scenarios/doubleCount";
import { checkMissingCoefficient } from "./scenarios/missingCoef";
import { checkWinterSurcharge } from "./scenarios/winterSurcharge";

/** Запустить все AI-проверки на ЛСР. */
export function runAiAdvisor(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];
  notices.push(...detectMissingOpeningSubtraction(lsr, object));
  notices.push(...checkDoubleCount(lsr));
  notices.push(...checkMissingCoefficient(lsr));
  notices.push(...checkWinterSurcharge(lsr));
  return notices;
}
