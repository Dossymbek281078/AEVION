import type { Lsr, AiNotice, LearningObject } from "../types";
import { detectMissingOpeningSubtraction } from "./scenarios/openings";
import { checkDoubleCount } from "./scenarios/doubleCount";
import { checkMissingCoefficient } from "./scenarios/missingCoef";
import { checkWinterSurcharge } from "./scenarios/winterSurcharge";
import { checkIndexMismatch } from "./scenarios/indexMismatch";
import { checkOverheadMismatch } from "./scenarios/overheadMismatch";
import { checkHeightCoefficient } from "./scenarios/heightCoef";
import { checkWrongUnit } from "./scenarios/wrongUnit";
import { checkMissingPreparation } from "./scenarios/missingPreparation";
import { checkSoilCategoryMismatch } from "./scenarios/soilCategoryMismatch";
import { checkFormworkMissing } from "./scenarios/formworkMissing";
import { checkTransportMissing } from "./scenarios/transportMissing";
import { checkDemolitionDoubled } from "./scenarios/demolitionDoubled";
import { checkScaffoldingMissing } from "./scenarios/scaffoldingMissing";
import { checkDismantlingCoefMissing } from "./scenarios/dismantlingCoefMissing";
import { checkWasteFactorMissing } from "./scenarios/wasteFactorMissing";

/** Запустить все AI-проверки на ЛСР. */
export function runAiAdvisor(lsr: Lsr, object: LearningObject): AiNotice[] {
  const notices: AiNotice[] = [];
  // Базовые проверки (предыдущая серия)
  notices.push(...detectMissingOpeningSubtraction(lsr, object));
  notices.push(...checkDoubleCount(lsr));
  notices.push(...checkMissingCoefficient(lsr));
  notices.push(...checkWinterSurcharge(lsr));
  notices.push(...checkIndexMismatch(lsr));
  notices.push(...checkOverheadMismatch(lsr));
  notices.push(...checkHeightCoefficient(lsr, object));
  // Расширенные проверки (8 новых сценариев — batch C)
  notices.push(...checkWrongUnit(lsr));
  notices.push(...checkMissingPreparation(lsr));
  notices.push(...checkSoilCategoryMismatch(lsr));
  notices.push(...checkFormworkMissing(lsr));
  notices.push(...checkTransportMissing(lsr));
  notices.push(...checkDemolitionDoubled(lsr));
  notices.push(...checkScaffoldingMissing(lsr, object));
  notices.push(...checkDismantlingCoefMissing(lsr));
  notices.push(...checkWasteFactorMissing(lsr));
  return notices;
}
